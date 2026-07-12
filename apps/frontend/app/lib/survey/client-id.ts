// ── Stable per-browser client id (issue #31) ────────────────────────
//
// A random, anonymous identifier persisted in localStorage. Used only for the
// optional one-response-per-browser guard; the backend stores a hash of it.

const KEY = "survey-client-id";

export function getClientId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // Storage disabled — fall back to an ephemeral id (guard becomes best-effort).
    return crypto.randomUUID();
  }
}
