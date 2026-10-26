import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALES, en, translations, type Locale, type TranslationKey } from "./translations";

export async function serverLocale(): Promise<Locale> {
  const value = (await cookies()).get("locale")?.value;
  return (LOCALES as readonly string[]).includes(value ?? "") ? (value as Locale) : DEFAULT_LOCALE;
}

export async function serverT(): Promise<(key: TranslationKey) => string> {
  const dict = translations[await serverLocale()];
  return (key) => dict[key] ?? en[key];
}
