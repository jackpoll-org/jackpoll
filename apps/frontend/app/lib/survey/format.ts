/**
 * Small, dependency-free date/duration formatters for the results page.
 * Uses the platform Intl APIs so output is localized (German default) without
 * pulling in date-fns.
 */

/**
 * Ratio → whole-number percent, clamped to 0–100. Guards against a zero
 * denominator and against >100% funnel artifacts (e.g. submits without a
 * recorded view).
 */
export function clampPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((numerator / denominator) * 100)));
}

/** Human duration: `45s`, `2m 05s`. Returns `—` for null/negative input. */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || ms < 0) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/** Localized date-only formatting for a plain "YYYY-MM-DD" value (no timezone
 *  shifting, unlike `new Date(iso)` on a date-only string). */
export function formatDateOnly(value: string, locale: string): string {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(y, m - 1, d));
}

/** Absolute local timestamp, e.g. for tooltips. */
export function formatAbsolute(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

const RELATIVE_UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
];

/**
 * Relative time such as "vor 2 Stunden" / "2 hours ago". Falls back to `—`
 * for missing/invalid input. Future timestamps are handled by Intl too.
 */
export function formatRelative(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  const diffSeconds = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 5) {
    // "just now" reads better than "in 0 seconds".
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(0, "second");
  }

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, secondsPerUnit] of RELATIVE_UNITS) {
    if (abs >= secondsPerUnit || unit === "second") {
      const value = Math.round(diffSeconds / secondsPerUnit);
      return rtf.format(value, unit);
    }
  }
  return formatAbsolute(iso, locale);
}
