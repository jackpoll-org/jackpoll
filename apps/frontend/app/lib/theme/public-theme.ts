const PUBLIC_PREFIXES = ["/s/", "/join/", "/results/", "/embed/", "/e/", "/r/"];

export const PUBLIC_THEME_STORAGE_KEY = "public-theme";

export function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/join" || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function forcesLightTheme(settings: { backgroundColor?: string }): boolean {
  return Boolean(settings.backgroundColor);
}

const DARK_FOREGROUND = "#0a0a0a";

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = [0, 2, 4].map((i) => channelLuminance(parseInt(hex.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function readableForeground(color: string): string | undefined {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return undefined;
  const hex = match[1].length === 3 ? [...match[1]].map((c) => c + c).join("") : match[1];
  const accent = luminance(hex) + 0.05;
  const dark = luminance(DARK_FOREGROUND.slice(1)) + 0.05;
  return 1.05 / accent >= accent / dark ? "#ffffff" : DARK_FOREGROUND;
}
