// ── iOS push notifications via APNs (#51) ──────────────────────────
//
// iOS is the odd one out: a WKWebView has no Push API, so neither the browser
// path (web-push.ts) nor UnifiedPush (push.ts) works. The app registers with
// APNs instead and hands the device token to the backend, which delivers via
// ApnsService. Android keeps using UnifiedPush — this module is iOS-only and
// every entry point no-ops elsewhere.

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { registerDeviceApi } from "@/app/lib/survey/api";

/** Platform id sent to the backend so it routes this device to APNs. */
const PLATFORM = "ios";

export function apnsSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

/** The APNs device token of this install, once registration succeeded. */
let deviceToken: string | null = null;
let listenersBound = false;

const errorListeners = new Set<(reason: string) => void>();

/** Subscribe to APNs registration failures. Returns an unsubscribe function. */
export function onApnsRegistrationFailed(cb: (reason: string) => void): () => void {
  errorListeners.add(cb);
  return () => errorListeners.delete(cb);
}

async function bindListeners(): Promise<void> {
  if (listenersBound) return;
  listenersBound = true;
  // APNs hands the token back asynchronously, so registration completes here
  // rather than in registerApns().
  await PushNotifications.addListener("registration", (token) => {
    if (!token.value) return;
    deviceToken = token.value;
    void registerDeviceApi(token.value, PLATFORM).catch(() => {
      // Best-effort: the app stays usable without push.
    });
  });
  await PushNotifications.addListener("registrationError", (err) => {
    const reason = typeof err?.error === "string" ? err.error : "unknown";
    for (const cb of errorListeners) cb(reason);
  });
}

/**
 * Ask for the notification permission and register with APNs. Returns whether
 * the user granted permission — the token itself arrives via the listener.
 *
 * Only call this from an explicit "turn on notifications" action: iOS shows the
 * system prompt exactly once per install, so spending it on app start would
 * leave the user no way back except the Settings app.
 */
export async function registerApns(): Promise<boolean> {
  if (!apnsSupported()) return false;
  await bindListeners();
  let status = await PushNotifications.checkPermissions();
  if (status.receive === "prompt" || status.receive === "prompt-with-rationale") {
    status = await PushNotifications.requestPermissions();
  }
  if (status.receive !== "granted") return false;
  await PushNotifications.register();
  return true;
}

/**
 * Refresh the APNs token if the user already allowed notifications — APNs may
 * hand out a new one at any time, and the backend needs the current one. Never
 * prompts, so it is safe to run on every app start.
 */
export async function resumeApnsRegistration(): Promise<void> {
  if (!apnsSupported()) return;
  if (!(await apnsPermissionGranted())) return;
  await bindListeners();
  await PushNotifications.register();
}

/** Stop receiving pushes on this device. */
export async function unregisterApns(): Promise<void> {
  if (!apnsSupported()) return;
  await PushNotifications.unregister();
  deviceToken = null;
}

/** The registered token, or null while unregistered. */
export function apnsToken(): string | null {
  return deviceToken;
}

/** Whether iOS currently allows notifications for this app. */
export async function apnsPermissionGranted(): Promise<boolean> {
  if (!apnsSupported()) return false;
  const status = await PushNotifications.checkPermissions();
  return status.receive === "granted";
}
