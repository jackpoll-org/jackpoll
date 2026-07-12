// ── Biometric unlock (mobile-app phase 3) ──────────────────────────
//
// Face ID / fingerprint gate for re-opening a stored session inside the native
// app. No-op on the web (the browser has no biometric API here).

import { Capacitor } from "@capacitor/core";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";

/** Only the native shell can prompt for biometrics. */
export function biometricSupported(): boolean {
  return Capacitor.isNativePlatform();
}

const ENABLED_KEY = "biometric-enabled";

/** Whether the user has biometric unlock enabled (per device; opt-in, default off). */
export function biometricEnabled(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(ENABLED_KEY) === "true";
}

/** Persist the user's biometric-unlock preference. */
export function setBiometricEnabled(on: boolean): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(ENABLED_KEY, on ? "true" : "false");
  }
}

/** Re-lock after the app has been backgrounded for at least this long. */
export const BIOMETRIC_IDLE_MS = 60_000;

// ── Session unlock memory ─────────────────────────────────────────
//
// A module-level timestamp of the last successful biometric verification.
// Survives React remounts and client-side navigation (lost only on a full
// WebView reload / cold launch), so navigating away and back — clicking the
// logo, switching language — does NOT re-prompt. The restore prompt
// (RequireAuth) and the lock prompt (BiometricLock) share it, so a single
// Face ID on session restore also satisfies the lock gate.

let lastUnlockAt: number | null = null;

/** Record a successful biometric verification as "just now". */
export function markBiometricUnlocked(): void {
  lastUnlockAt = Date.now();
}

/** True if a biometric verification happened within the idle window. */
export function biometricUnlockedRecently(): boolean {
  return lastUnlockAt !== null && Date.now() - lastUnlockAt < BIOMETRIC_IDLE_MS;
}

/** Forget the last unlock (e.g. on logout) so the next session re-prompts. */
export function clearBiometricUnlock(): void {
  lastUnlockAt = null;
}

/**
 * Prompt for biometric (or device-credential) verification.
 * Returns true when verified — or when the device has no biometrics enrolled,
 * so users are never locked out of their own session.
 */
export async function verifyIdentity(reason: string): Promise<boolean> {
  if (!biometricSupported()) return true;

  // Availability check — if the plugin or device can't report it (any error),
  // fail OPEN so the user is never trapped behind a broken lock screen.
  try {
    const info = await BiometricAuth.checkBiometry();
    if (!info.isAvailable) return true;
  } catch {
    return true;
  }

  // Actual prompt. A genuine cancel/failure keeps the screen locked; any other
  // error also fails open rather than crashing or trapping the user.
  try {
    await BiometricAuth.authenticate({
      reason,
      allowDeviceCredential: true,
      cancelTitle: "Cancel",
      iosFallbackTitle: "Use passcode",
    });
    return true;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    // Only an explicit user cancel/failure should keep things locked.
    if (code === "userCancel" || code === "authenticationFailed" || code === "userFallback") {
      return false;
    }
    return true;
  }
}
