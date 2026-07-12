// Client-side cookie helpers, shared by the theme provider, i18n, and UI
// preferences so the read/write logic lives in one place.

const ONE_YEAR = 31536000;

/**
 * Set (or, when `value` is null/empty, clear) a cookie. Mirrors the prior
 * inline helpers in active-theme.tsx and i18n/context.tsx: path=/, SameSite=Lax,
 * Secure on https.
 */
export function setCookie(key: string, value: string | null, maxAge = ONE_YEAR): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "Secure;" : "";
  if (!value) {
    document.cookie = `${key}=; path=/; max-age=0; SameSite=Lax; ${secure}`;
  } else {
    document.cookie = `${key}=${value}; path=/; max-age=${maxAge}; SameSite=Lax; ${secure}`;
  }
}

/** Read a cookie value, or null when absent / on the server. */
export function getCookie(key: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
