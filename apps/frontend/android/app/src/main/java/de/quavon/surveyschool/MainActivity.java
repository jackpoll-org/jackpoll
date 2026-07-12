package de.quavon.surveyschool;

import android.content.SharedPreferences;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.CapConfig;

public class MainActivity extends BridgeActivity {
    // Load the configured self-host instance directly (no bundled bootstrap page,
    // no purple flash). The bridge's server URL is set in the config so the
    // remote instance is treated as the app's own origin — navigations after
    // login stay in-app instead of being intercepted as external links.
    // The URL is stored by the web app via @capacitor/preferences
    // (SharedPreferences "CapacitorStorage" / key "instance_url").
    @Override
    protected void load() {
        CapConfig defaults = CapConfig.loadDefault(this);
        // Respect a CAP_SERVER_URL dev build (server.url already in the config).
        if (defaults.getServerUrl() == null) {
            SharedPreferences sp = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
            String stored = sp.getString("instance_url", null);
            String url = (stored != null && !stored.isEmpty())
                ? stored
                : "https://app.jackpoll.org";
            config = new CapConfig.Builder(this)
                .setServerUrl(url)
                .setAllowNavigation(new String[] { "*" })
                .setAndroidScheme("https")
                .create();
        }
        super.load();
    }
}
