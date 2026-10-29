import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALES, en, translations, type Locale, type TranslationKey } from "./translations";

function isLocale(value: string | undefined): value is Locale {
  return (LOCALES as readonly string[]).includes(value ?? "");
}

export function negotiateLocale(cookie: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(cookie)) return cookie;
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const preferred = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { lang: tag.trim().toLowerCase().split("-")[0], q: q ? Number(q.trim().slice(2)) : 1 };
    })
    .filter((entry) => entry.lang && entry.q > 0)
    .sort((a, b) => b.q - a.q)
    .find((entry) => isLocale(entry.lang));
  return preferred ? (preferred.lang as Locale) : "en";
}

export async function serverLocale(): Promise<Locale> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return negotiateLocale(cookieStore.get("locale")?.value, headerStore.get("accept-language"));
}

export async function serverT(): Promise<(key: TranslationKey) => string> {
  const dict = translations[await serverLocale()];
  return (key) => dict[key] ?? en[key];
}
