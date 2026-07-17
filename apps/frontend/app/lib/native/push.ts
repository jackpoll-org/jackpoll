// ── Native push notifications via UnifiedPush ──────────────────────
//
// Replaces the old FCM-only setup. On Android the native UnifiedPush bridge
// (registerPlugin "UnifiedPush") resolves a distributor (external like ntfy /
// NextPush, or — play flavor only — a bundled Embedded FCM fallback) and hands
// us a Web Push endpoint + keys, which we register with the backend exactly
// like a browser PushSubscription. No-op on the web (see web-push.ts there).

import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { registerDeviceApi } from "@/app/lib/survey/api";

export type PushOutcome =
  | "REGISTERING"
  | "NEEDS_PICKER"
  | "NEEDS_DISTRIBUTOR"
  | "UNSUPPORTED";

export interface PushStatus {
  registered: boolean;
  distributor: string | null;
  hasEmbeddedFallback: boolean;
  installedDistributors: string;
  endpoint: string | null;
  pubKey: string | null;
  auth: string | null;
}

interface EndpointEvent {
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
}

interface UnifiedPushPlugin {
  register(): Promise<{ outcome: PushOutcome }>;
  unregister(): Promise<void>;
  getStatus(): Promise<PushStatus>;
  listDistributors(): Promise<{ distributors: string }>;
  pickDistributor(options: { distributor: string }): Promise<void>;
  addListener(
    event: "endpointChanged" | "unregistered" | "registrationFailed",
    cb: (data: EndpointEvent & { reason?: string }) => void,
  ): Promise<PluginListenerHandle>;
}

const UnifiedPush = registerPlugin<UnifiedPushPlugin>("UnifiedPush");

export function pushSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

const errorListeners = new Set<(reason: string) => void>();

/** Subscribe to native registration failures (e.g. FCM init errors). Returns an unsubscribe function. */
export function onPushRegistrationFailed(cb: (reason: string) => void): () => void {
  errorListeners.add(cb);
  return () => errorListeners.delete(cb);
}

let endpointBound = false;
async function bindEndpointListener(): Promise<void> {
  if (endpointBound) return;
  endpointBound = true;
  await UnifiedPush.addListener("endpointChanged", (e) => {
    if (!e.endpoint) return;
    const keys = e.p256dh && e.auth ? { p256dh: e.p256dh, auth: e.auth } : undefined;
    // "android-up" tells the backend this is a UnifiedPush (Web Push) endpoint.
    void registerDeviceApi(e.endpoint, "android-up", keys).catch(() => {
      // Best-effort; the user can still use the app without push.
    });
  });
  // Previously dropped silently — the only symptom was "no device registered"
  // on the debug page, with no indication of why registration never happened.
  await UnifiedPush.addListener("registrationFailed", (e) => {
    for (const cb of errorListeners) cb(e.reason ?? "unknown");
  });
  await UnifiedPush.addListener("unregistered", () => {
    for (const cb of errorListeners) cb("unregistered");
  });
}

/** Start/refresh push registration. Returns the immediate outcome for the UI. */
export async function registerPush(): Promise<PushOutcome> {
  if (!pushSupported()) return "UNSUPPORTED";
  await bindEndpointListener();
  const { outcome } = await UnifiedPush.register();
  return outcome;
}

export async function unregisterPush(): Promise<void> {
  if (pushSupported()) await UnifiedPush.unregister();
}

export async function getPushStatus(): Promise<PushStatus | null> {
  if (!pushSupported()) return null;
  return UnifiedPush.getStatus();
}

export async function listPushDistributors(): Promise<string[]> {
  if (!pushSupported()) return [];
  const { distributors } = await UnifiedPush.listDistributors();
  return distributors ? distributors.split(",").filter(Boolean) : [];
}

export async function pickPushDistributor(distributor: string): Promise<void> {
  if (pushSupported()) await UnifiedPush.pickDistributor({ distributor });
}
