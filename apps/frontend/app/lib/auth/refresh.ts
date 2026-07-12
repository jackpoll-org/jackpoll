// ── Silent token refresh (issue #35) ────────────────────────────────
//
// Exchanges the httpOnly refresh cookie for a fresh access token via the
// backend `/auth/refresh` endpoint. A single in-flight refresh is shared by all
// callers (single-flight), so concurrent 401s trigger exactly one refresh.

import { Capacitor } from "@capacitor/core";
import { API_BASE_URL } from "./constants";
import { clearAuth, storeAuth } from "./storage";

let inFlight: Promise<string | null> | null = null;

/**
 * Refresh the access token. Returns the new token, or null when the session
 * cannot be refreshed (in which case auth is cleared and the user is sent to
 * the login page with a "session expired" notice).
 */
export function refreshAccessToken(): Promise<string | null> {
  if (inFlight) return inFlight;
  inFlight = doRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include", // send the httpOnly refresh cookie
    });
    if (!res.ok) return onFailed();

    const body = await res.json().catch(() => null);
    const token: string | undefined = body?.data?.tokens?.accessToken;
    if (!token) return onFailed();

    storeAuth(token, body.data.user);
    return token;
  } catch {
    return onFailed();
  }
}

function onFailed(): null {
  clearAuth();
  // On native, don't hard-redirect to /login: that would bypass the biometric
  // unlock screen (RequireAuth) which can restore the session from the stored
  // offline token. With the access token cleared, RequireAuth re-evaluates and
  // shows the unlock prompt (or redirects itself when no biometric session
  // exists). The web keeps the hard redirect.
  if (Capacitor.isNativePlatform()) {
    return null;
  }
  // Hard redirect (we're outside React here). Skip if already on an auth page
  // to avoid loops, and preserve the intended destination.
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    const onAuthPage =
      path.startsWith("/login") ||
      path.startsWith("/register") ||
      path.startsWith("/forgot-password") ||
      path.startsWith("/reset-password");
    if (!onAuthPage) {
      const redirect = encodeURIComponent(path + window.location.search);
      window.location.assign(`/login?expired=1&redirect=${redirect}`);
    }
  }
  return null;
}
