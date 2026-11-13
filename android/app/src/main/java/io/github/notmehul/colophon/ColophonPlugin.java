package io.github.notmehul.colophon;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;

/**
 * Colophon's own native calls (src/platform/barcode.ts).
 *
 * scanBarcode: Google's Code Scanner. Play services draws the camera UI, so the
 * app needs no CAMERA permission and bundles no model. Resolves with the raw
 * code (an ISBN for EAN-13 978/979 codes), or with no value when cancelled.
 *
 * openWith: hands a file Colophon wrote to its cache to one named app, as
 * Open with does (src/platform/handoff.ts, "Read in Rosetta"). The app gets a
 * read grant on that one file's content:// URI and nothing else.
 */
@CapacitorPlugin(name = "Colophon")
public class ColophonPlugin extends Plugin {

    private static final GmsBarcodeScannerOptions OPTIONS = new GmsBarcodeScannerOptions.Builder()
        .setBarcodeFormats(Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8, Barcode.FORMAT_UPC_A, Barcode.FORMAT_UPC_E)
        .enableAutoZoom()
        .build();

    @PluginMethod
    public void scanBarcode(PluginCall call) {
        GmsBarcodeScanning.getClient(getActivity(), OPTIONS)
            .startScan()
            .addOnSuccessListener(barcode -> {
                JSObject result = new JSObject();
                result.put("value", barcode.getRawValue());
                call.resolve(result);
            })
            .addOnCanceledListener(() -> call.resolve(new JSObject()))
            .addOnFailureListener(e -> call.reject("The barcode scanner isn't available: " + e.getMessage(), e));
    }

    @PluginMethod
    public void openWith(PluginCall call) {
        String uri = call.getString("uri");
        String mime = call.getString("mime", "application/octet-stream");
        String target = call.getString("package");
        if (uri == null || target == null) {
            call.reject("uri and package are needed");
            return;
        }
        JSObject result = new JSObject();
        PackageManager pm = getContext().getPackageManager();
        try {
            pm.getPackageInfo(target, 0);
        } catch (PackageManager.NameNotFoundException e) {
            result.put("installed", false);
            result.put("opened", false);
            call.resolve(result);
            return;
        }
        result.put("installed", true);
        try {
            java.io.File file = new java.io.File(Uri.parse(uri).getPath());
            Uri content = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent intent = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(content, mime)
                .setPackage(target)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            result.put("opened", true);
        } catch (ActivityNotFoundException | IllegalArgumentException e) {
            result.put("opened", false);
        }
        call.resolve(result);
    }
}
