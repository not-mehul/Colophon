package io.github.notmehul.colophon;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/**
 * Capacitor shell for Colophon. EPUBs opened with Colophon arrive as VIEW
 * intents (AndroidManifest.xml), which the App plugin passes to the page as
 * appUrlOpen; native calls of Colophon's own are in {@link ColophonPlugin}.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ColophonPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
