// ── Web Push notifications for browsers (PWA, #74) ─────────────────
//
// Subscribes the browser to Web Push via the service worker's PushManager and
// registers the subscription (endpoint + encryption keys) with the backend so
// owners are notified of new responses. Counterpart to native push.ts. No-op
// unless the browser supports Push, the SW is active, the user grants
// permission, and the instance has VAPID configured.

import { Capacitor } from "@capacitor/core";
import { getWebPushKeyApi, registerDeviceApi } from "@/app/lib/survey/api";

/** Web Push is a browser-only feature — native uses FCM/APNs instead. */
export function webPushSupported(): boolean {
  return (
    !Capacitor.isNativePlatform() &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Decode a base64url VAPID key into the Uint8Array applicationServerKey wants. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Subscribe to Web Push and register the subscription with the backend. Safe to
 * call repeatedly — an existing subscription is reused. Best-effort: any failure
 * (no SW, denied permission, push disabled on the instance) resolves silently.
 */
export async function subscribeWebPush(): Promise<void> {
  if (!webPushSupported()) return;

  // Only subscribe if this instance actually sends Web Push.
  let publicKey: string;
  try {
    const res = await getWebPushKeyApi();
    if (!res.data?.enabled || !res.data.publicKey) return;
    publicKey = res.data.publicKey;
  } catch {
    return;
  }

  if (Notification.permission === "denied") return;
  if (Notification.permission === "default") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));

    const json = subscription.toJSON();
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!json.endpoint || !p256dh || !auth) return;

    await registerDeviceApi(json.endpoint, "web", { p256dh, auth });
  } catch {
    // Best-effort; the app works without push.
  }
}
