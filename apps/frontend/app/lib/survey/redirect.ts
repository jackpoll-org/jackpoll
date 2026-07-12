// ── Safe survey post-submission redirect ────────────────────────────
//
// A survey owner can set `settings.redirectUrl`, rendered as a link on the
// confirmation page. Owners may type a bare host ("example.com") or a full URL,
// but we only ever allow http/https: anything with another scheme
// (`javascript:`, `data:`, `mailto:`…) is rejected so the confirmation link
// can't be turned into script execution or an unexpected scheme. Returns a
// normalised absolute URL, or null when there is no usable/safe target.

export function normalizeRedirectUrl(
  raw: string | null | undefined,
): string | null {
  const value = raw?.trim();
  if (!value) return null;
  // A leading scheme (e.g. "javascript:") means the value already declares its
  // protocol; a bare host has none, so we default it to https.
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
  const candidate = hasScheme ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
