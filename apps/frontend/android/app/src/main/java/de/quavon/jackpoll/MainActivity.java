package de.quavon.jackpoll;

import android.content.SharedPreferences;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.CapConfig;
import de.quavon.jackpoll.push.PushBridgePlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register the native bridges before the WebView bridge boots.
        registerPlugin(PushBridgePlugin.class);
        registerPlugin(InstancePlugin.class);
        super.onCreate(savedInstanceState);
    }

    // Load the configured self-host instance directly (no bundled bootstrap page,
    // no purple flash). The bridge's server URL is set in the config so the
    // remote instance is treated as the app's own origin: its pages stay in-app
    // with the native bridge, while every other host (links in surveys, redirect
    // URLs, embeds) opens in the external browser. No allowNavigation is set on
    // purpose. Switching instances goes through InstancePlugin, which stores the
    // new URL and recreates this activity.
    // The URL is stored via @capacitor/preferences
    // (SharedPreferences "CapacitorStorage" / key "instance_url").
    @Override
    protected void load() {
        CapConfig defaults = CapConfig.loadDefault(this);
        // Respect a CAP_SERVER_URL dev build (server.url already in the config).
        if (defaults.getServerUrl() == null) {
            SharedPreferences sp = getSharedPreferences(InstancePlugin.PREFS_NAME, MODE_PRIVATE);
            String stored = sp.getString(InstancePlugin.KEY_INSTANCE_URL, null);
            String url = (stored != null && !stored.isEmpty())
                ? stored
                : InstancePlugin.DEFAULT_INSTANCE_URL;
            config = new CapConfig.Builder(this)
                .setServerUrl(url)
                .setAndroidScheme("https")
                .create();
        }
        super.load();
    }
}
