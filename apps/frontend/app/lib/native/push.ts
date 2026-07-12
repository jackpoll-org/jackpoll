// ── Native push notifications (mobile-app phase 3) ─────────────────
//
// Registers the device's push token with the backend so owners can be notified
// of new responses. No-op on the web.

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { registerDeviceApi } from "@/app/lib/survey/api";

export function pushSupported(): boolean {
  if (!Capacitor.isNativePlatform()) return false;
  // Android push requires a Firebase `google-services.json`. Without it the
  // native PushNotifications.register() throws "Default FirebaseApp is not
  // initialized" on the CapacitorPlugins thread — an uncaught exception that
  // crashes the whole app (a JS try/catch can't catch it). Until Firebase is
  // wired up, skip Android entirely so the app no longer crashes after login.
  if (Capacitor.getPlatform() === "android") return false;
  return true;
}

/**
 * Ask for permission, then register the device token with the backend. Safe to
 * call more than once; listeners are reset each time.
 */
export async function registerPush(): Promise<void> {
  if (!pushSupported()) return;

  let { receive } = await PushNotifications.checkPermissions();
  if (receive === "prompt" || receive === "prompt-with-rationale") {
    receive = (await PushNotifications.requestPermissions()).receive;
  }
  if (receive !== "granted") return;

  await PushNotifications.removeAllListeners();
  await PushNotifications.addListener("registration", (token) => {
    void registerDeviceApi(token.value, Capacitor.getPlatform()).catch(() => {
      // Best-effort; the user can still use the app without push.
    });
  });
  await PushNotifications.register();
}
