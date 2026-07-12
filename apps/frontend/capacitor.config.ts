import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Self-host friendly (no rebuild): the app boots the bundled picker
 * (mobile/www) instead of a fixed server.url. The picker stores the chosen
 * instance URL (@capacitor/preferences) and navigates the WebView there; the
 * native bridge stays active on any instance via allowNavigation. Offline is
 * handled by the service worker (public/sw.js) once an instance is loaded.
 *
 * Dev override: set CAP_SERVER_URL (e.g. your LAN IP) before `npx cap sync` to
 * boot straight into a fixed deployment and skip the picker —
 * e.g. CAP_SERVER_URL=http://192.168.1.20:3000.
 */
const DEV_SERVER_URL = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: "de.quavon.surveyschool",
  appName: "Jackpoll",
  // The bundled instance picker (and offline fallback) is served from here.
  webDir: "mobile/www",
  // Stable local origins so the web app can navigate back to the picker:
  // iOS = capacitor://localhost, Android = https://localhost.
  server: {
    // No fixed url in the shipped app → it boots the picker. CAP_SERVER_URL
    // lets a dev build target one deployment directly.
    ...(DEV_SERVER_URL ? { url: DEV_SERVER_URL } : {}),
    androidScheme: "https",
    iosScheme: "capacitor",
    // Allow the bridge to stay active on whatever instance the user connects to.
    allowNavigation: ["*"],
  },
  ios: {
    // CSS safe-area-inset padding handles the notch/home-indicator, so the
    // native scroll-view inset is redundant and only added a black scrollable
    // strip. "never" lets the web layout own all insets. Bounce is disabled in
    // MainViewController so overscroll can't reveal the webview background.
    contentInset: "never",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: "#ffffffff",
      showSpinner: false,
    },
  },
};

export default config;
