// ── Collaborator identity (issue #85 / #22) ─────────────────────────
//
// Passwordless collab-link editors are anonymous (no auth user), so the live
// co-editing provider — which needs a `user` to start — never runs for them.
// These helpers mint a lightweight *guest* identity (display-only, unverified)
// and remember the chosen name so a returning collaborator isn't re-prompted.

import type { User } from "@/app/types/auth";

const NAME_KEY = "jackpoll.collab.name";

/** Read the previously entered collaborator name, if any (SSR-safe). */
export function loadStoredName(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const name = window.localStorage.getItem(NAME_KEY);
    return name && name.trim() ? name : null;
  } catch {
    return null;
  }
}

/** Remember the collaborator name for next time (SSR-safe, best-effort). */
export function storeName(name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NAME_KEY, name.trim());
  } catch {
    // ignore quota / privacy-mode failures
  }
}

/**
 * A synthetic, unverified guest user for passwordless collaboration. The
 * `guest:` id prefix gives a stable per-session colour (via `colorFor`) and
 * makes clear the identity is display-only — never trust it for authorization
 * (that lives in the collab-link slug + expiry check on the backend).
 */
export function makeGuestUser(name: string): User {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return {
    id: `guest:${id}`,
    email: "",
    name: name.trim(),
    emailVerified: false,
    createdAt: new Date().toISOString(),
  };
}
