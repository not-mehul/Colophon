package io.github.notmehul.colophon;

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
}
