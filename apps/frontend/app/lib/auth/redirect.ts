// ── Safe post-auth redirect ─────────────────────────────────────────
//
// The login flow reads a `?redirect=` query param and navigates there after a
// successful sign-in. That value is attacker-controllable (anyone can craft a
// link), so it must be constrained to a same-origin path — otherwise
// `/login?redirect=https://evil.com` becomes an open redirect that bounces an
// authenticated user off-site (phishing).

// Control chars (incl. \t \n \r), DEL, and backslashes can be normalised by the
// browser into an origin-changing URL — reject any of them.
// eslint-disable-next-line no-control-regex
const UNSAFE_PATH_CHARS = /[\x00-\x1f\x7f\\]/;

/**
 * Return `raw` only when it is a safe same-origin path to navigate to, else
 * `undefined`. Accepts a single-slash absolute path (`/dashboard`); rejects
 * absolute URLs, protocol-relative (`//evil.com`) and backslash-smuggled
 * (`/\evil.com`) values, and anything carrying control characters.
 */
export function safeInternalPath(
  raw: string | null | undefined,
): string | undefined {
  if (!raw) return undefined;
  if (!raw.startsWith("/")) return undefined;
  // "//host" resolves to another origin in the browser.
  if (raw.startsWith("//")) return undefined;
  if (UNSAFE_PATH_CHARS.test(raw)) return undefined;
  return raw;
}
