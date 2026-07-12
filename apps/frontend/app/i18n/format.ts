// ── Locale-aware formatting ─────────────────────────────────────────
//
// Intl formatters are expensive to construct, so they are built once per
// (locale, options) combination and reused, rather than rebuilt on every call.

import type { Locale } from "./translations";

const INTL_LOCALE: Record<Locale, string> = {
  de: "de-DE",
  en: "en-US",
};

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const numberFormatters = new Map<string, Intl.NumberFormat>();

function dateFormatter(
  locale: Locale,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(INTL_LOCALE[locale], options);
    dateFormatters.set(key, formatter);
  }
  return formatter;
}

function numberFormatter(
  locale: Locale,
  options?: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${locale}|${options ? JSON.stringify(options) : ""}`;
  let formatter = numberFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(INTL_LOCALE[locale], options);
    numberFormatters.set(key, formatter);
  }
  return formatter;
}

export function formatDate(
  value: string | number | Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  return dateFormatter(locale, options).format(new Date(value));
}

export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
): string {
  return numberFormatter(locale, options).format(value);
}
