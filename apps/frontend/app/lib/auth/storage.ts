// ── Client-side auth storage (issue #35) ────────────────────────────
//
// The access token lives in localStorage (sent as a Bearer header) and is
// mirrored into the `survey-auth-token` cookie that the Next route guard
// (proxy.ts) reads server-side. The REFRESH token is never stored here — it is
// an httpOnly cookie set by the backend. Proper hardening (drop localStorage)
// is the remainder of #35's long-term direction.

import { AUTH_STORAGE_KEY, AUTH_USER_KEY } from "./constants";

/**
 * Same-tab notification that the auth token in localStorage changed. The native
 * `storage` event only fires in *other* tabs, so without this a biometric
 * restore (which writes the token in this tab) wouldn't re-enable the disabled
 * `/me` query — leaving the user unlocked but un-redirected.
 */
export const AUTH_STORAGE_EVENT = "auth-storage";

function notifyAuthChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_STORAGE_EVENT));
  }
}

/** Cookie attributes: Secure only over HTTPS so it still works on http://localhost. */
function cookieSuffix(): string {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? " Secure;"
      : "";
  return `path=/; SameSite=Lax;${secure}`;
}

export function storeAuth(accessToken: string, user: unknown): void {
  localStorage.setItem(AUTH_STORAGE_KEY, accessToken);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  document.cookie = `survey-auth-token=${accessToken}; max-age=86400; ${cookieSuffix()}`;
  notifyAuthChange();
}

export function clearAuth(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  document.cookie = `survey-auth-token=; max-age=0; ${cookieSuffix()}`;
  notifyAuthChange();
}

export function getStoredToken(): string | null {
  return typeof window !== "undefined"
    ? localStorage.getItem(AUTH_STORAGE_KEY)
    : null;
}

/** Expiry of a JWT in epoch milliseconds, or null if unparseable. */
export function jwtExpiryMs(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}
