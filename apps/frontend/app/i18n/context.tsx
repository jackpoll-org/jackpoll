"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALES,
  en,
  translations,
  type Locale,
  type TranslationKey,
} from "./translations";
import { setCookie } from "@/app/lib/cookies";
import { I18nContext, interpolate, type I18nContextValue, type TranslateFn, type TranslateParams } from "./i18n-context";

export const LOCALE_COOKIE = "locale";

function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

function setLocaleCookie(value: Locale) {
  setCookie(LOCALE_COOKIE, value);
}

export type { TranslateParams, TranslateFn } from "./i18n-context";


export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(
    () => initialLocale ?? DEFAULT_LOCALE,
  );

  // Honour a `?lang=` override once on mount. This is a deliberate one-time
  // sync from the URL (which is unavailable during SSR init), not a render loop.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("lang");
    if (isLocale(param) && param !== locale) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocaleState(param);
      setLocaleCookie(param);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    setLocaleCookie(next);
  }, []);

  const t = useCallback<TranslateFn>(
    (key, params) => {
      const dict = translations[locale];
      const value = dict[key] ?? en[key];
      return interpolate(value, params);
    },
    [locale],
  );

  const tPlural = useCallback(
    (base: string, count: number, params?: TranslateParams) => {
      const suffix = count === 1 ? "_one" : "_other";
      const key = `${base}${suffix}` as TranslationKey;
      const dict = translations[locale];
      const value = dict[key] ?? en[key] ?? base;
      return interpolate(value, { count, ...params });
    },
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t, tPlural }),
    [locale, setLocale, t, tPlural],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }
  return ctx;
}

