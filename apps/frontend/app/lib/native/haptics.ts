// ── Haptic feedback (mobile) ───────────────────────────────────────
//
// Thin wrapper over @capacitor/haptics. Native-only and opt-out (default on);
// every call is a no-op on the web, when disabled, or if the device has no
// haptics — callers never need to guard.

import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

const ENABLED_KEY = "haptics-enabled";

export { ImpactStyle, NotificationType };

/** Only the native shell can produce haptics. */
export function hapticsSupported(): boolean {
  return Capacitor.isNativePlatform();
}

/** Whether haptics are enabled (per device; default on, user can opt out). */
export function hapticsEnabled(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(ENABLED_KEY) !== "false";
}

/** Persist the user's haptics preference. */
export function setHapticsEnabled(on: boolean): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(ENABLED_KEY, on ? "true" : "false");
  }
}

function active(): boolean {
  return hapticsSupported() && hapticsEnabled();
}

/** A physical "tap" — use for confirming primary actions. */
export async function hImpact(style: ImpactStyle = ImpactStyle.Light): Promise<void> {
  if (!active()) return;
  try {
    await Haptics.impact({ style });
  } catch {
    // No haptics hardware / not permitted — ignore.
  }
}

/** Success / warning / error feedback — pair with result toasts. */
export async function hNotify(type: NotificationType): Promise<void> {
  if (!active()) return;
  try {
    await Haptics.notification({ type });
  } catch {
    // ignore
  }
}

/** A light tick for selection changes (toggles, option picks). */
export async function hSelection(): Promise<void> {
  if (!active()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // ignore
  }
}
