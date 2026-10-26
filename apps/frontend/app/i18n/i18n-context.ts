import { createContext } from "react";
import type { Locale, TranslationKey } from "./translations";

export type TranslateParams = Record<string, string | number>;
export type TranslateFn = (key: TranslationKey, params?: TranslateParams) => string;

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslateFn;
  /** Pick the `_one` / `_other` plural variant of a key by count. */
  tPlural: (base: string, count: number, params?: TranslateParams) => string;
}

export const I18nContext = createContext<I18nContextValue | undefined>(undefined);

/** Replace {placeholder} tokens in a string with provided params. */
export function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}
