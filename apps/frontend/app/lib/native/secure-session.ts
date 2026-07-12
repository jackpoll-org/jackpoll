// ── Secure offline-token storage (biometric persistent login) ──────
//
// Stores the Keycloak offline refresh token in the device keychain (iOS
// Keychain / Android Keystore) so the native app can restore an expired session
// after a biometric prompt — without the user re-typing their password. No-op on
// the web (there is no secure storage / offline token there).

import { Capacitor } from "@capacitor/core";
import {
  KeychainAccess,
  SecureStorage,
} from "@aparajita/capacitor-secure-storage";

const OFFLINE_TOKEN_KEY = "offline-refresh-token";

/** Secure storage is only meaningful inside the native shell. */
export function secureSessionSupported(): boolean {
  return Capacitor.isNativePlatform();
}

/** Persist the offline refresh token (device-only, available when unlocked). */
export async function storeOfflineToken(token: string): Promise<void> {
  if (!secureSessionSupported()) return;
  try {
    await SecureStorage.set(
      OFFLINE_TOKEN_KEY,
      token,
      false,
      false,
      KeychainAccess.whenUnlockedThisDeviceOnly,
    );
  } catch {
    // Best-effort; failure just means persistent login is unavailable.
  }
}

/** Read the stored offline refresh token, or null if none / on error. */
export async function getOfflineToken(): Promise<string | null> {
  if (!secureSessionSupported()) return null;
  try {
    const value = await SecureStorage.get(OFFLINE_TOKEN_KEY);
    return typeof value === "string" && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Remove the stored offline refresh token (logout / disable biometric). */
export async function clearOfflineToken(): Promise<void> {
  if (!secureSessionSupported()) return;
  try {
    await SecureStorage.remove(OFFLINE_TOKEN_KEY);
  } catch {
    // Already gone or storage unavailable — nothing to do.
  }
}

/** Whether a stored offline token exists (a biometric restore is possible). */
export async function hasOfflineToken(): Promise<boolean> {
  return (await getOfflineToken()) !== null;
}
