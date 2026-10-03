// ── Self-host instance selection (mobile) ──────────────────────────
//
// The native app boots straight into the configured instance (no picker
// screen). The instance URL lives in @capacitor/preferences and can be changed
// from the box under the login form. The web build is unaffected (no native
// platform → the box renders nothing and these helpers aren't used).

import { Capacitor, registerPlugin } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const INSTANCE_KEY = "instance_url";
const LAST_PATH_KEY = "last_path";

/** Native Android bridge (InstancePlugin.kt): stores the URL and reboots the app on it. */
const InstanceBridge = registerPlugin<{ switchTo(options: { url: string }): Promise<void> }>(
  "Instance",
);

/** The default instance the app boots into before the user changes it. */
export const DEFAULT_INSTANCE_URL = "https://app.jackpoll.org";

/** Only the native shell uses a configurable instance URL. */
export function instancePickerSupported(): boolean {
  return Capacitor.isNativePlatform();
}

/** The configured instance URL, or the default when none is stored. */
export async function getInstanceUrl(): Promise<string> {
  try {
    const { value } = await Preferences.get({ key: INSTANCE_KEY });
    return value || DEFAULT_INSTANCE_URL;
  } catch {
    return DEFAULT_INSTANCE_URL;
  }
}

/**
 * Remember the current in-app path so the native picker can restore it after a
 * relaunch/reload. The picker always boots into the instance *root*, so without
 * this a reload inside (say) a survey would dump the user back on the dashboard.
 * Stored in @capacitor/preferences because the picker (capacitor://localhost)
 * and the loaded instance (https://…) are different origins and can't share
 * localStorage — but they share native Preferences.
 */
export function isRememberablePath(pathWithQuery: string): boolean {
  // Only real in-app paths; never a transient auth screen or the bare root.
  return (
    pathWithQuery.startsWith("/") &&
    !pathWithQuery.startsWith("/login") &&
    !pathWithQuery.startsWith("/register")
  );
}

export async function rememberLastPath(pathWithQuery: string): Promise<void> {
  if (!instancePickerSupported()) return;
  if (!isRememberablePath(pathWithQuery)) return;
  try {
    await Preferences.set({ key: LAST_PATH_KEY, value: pathWithQuery });
  } catch {
    // Best-effort; a failure just means the next relaunch starts at the root.
  }
}

/** Normalize user input into a clean https origin (no trailing slash). */
export function normalizeInstanceUrl(raw: string): string {
  let u = (raw || "").trim().replace(/\/+$/, "");
  if (u && !/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

/**
 * Store the chosen instance and load it. On Android only the configured
 * instance's host stays in the WebView (other hosts open in the browser), so the
 * native bridge stores the URL and recreates the activity on the new instance.
 * iOS keeps the cross-origin navigation allowed by capacitor.config
 * `allowNavigation`, which keeps the native bridge active on the new instance.
 */
export async function switchToInstance(url: string): Promise<void> {
  if (Capacitor.getPlatform() === "android") {
    try {
      await InstanceBridge.switchTo({ url });
      return;
    } catch (err) {
      // App builds before 1.0.4 have no Instance bridge (the web UI comes from
      // the server, so it can be newer than the app): fall through to the old
      // navigation, which those builds still allow.
      if ((err as { code?: string })?.code !== "UNIMPLEMENTED") throw err;
    }
  }
  try {
    await Preferences.set({ key: INSTANCE_KEY, value: url });
  } catch {
    // If persistence fails we still navigate; it just won't be remembered.
  }
  window.location.replace(url);
}
