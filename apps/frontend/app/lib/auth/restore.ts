// ── Biometric session restore (native) ─────────────────────────────
//
// Exchanges the keychain-stored offline refresh token for a fresh access token
// via /auth/refresh (X-Refresh-Token header). Used by the native unlock screen
// after a successful biometric prompt to bring back an expired session. The
// caller is responsible for the biometric gate; this only does the token work.

import { API_BASE_URL } from "./constants";
import { storeAuth } from "./storage";
import {
  clearOfflineToken,
  getOfflineToken,
  storeOfflineToken,
} from "@/app/lib/native/secure-session";

/**
 * Restore the session from the stored offline token.
 * @returns true on success (access token persisted). On a hard 401 the offline
 *   token is wiped (revoked/expired); any other failure leaves it in place so a
 *   later attempt (e.g. back online) can still work.
 */
export async function restoreWithOfflineToken(): Promise<boolean> {
  const offlineToken = await getOfflineToken();
  if (!offlineToken) return false;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "X-Refresh-Token": offlineToken },
      credentials: "include",
    });

    if (!res.ok) {
      // 401 => the offline token is no longer valid; stop offering restore.
      if (res.status === 401) await clearOfflineToken();
      return false;
    }

    const body = await res.json().catch(() => null);
    const accessToken: string | undefined = body?.data?.tokens?.accessToken;
    if (!accessToken) return false;

    storeAuth(accessToken, body.data.user);

    // The backend rotates the offline token on refresh — persist the new one.
    const rotated: string | undefined = body?.data?.offlineToken;
    if (rotated) await storeOfflineToken(rotated);

    return true;
  } catch {
    return false;
  }
}
