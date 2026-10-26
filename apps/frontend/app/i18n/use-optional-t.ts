"use client";

import { useContext } from "react";
import { I18nContext, interpolate, type TranslateFn } from "./i18n-context";
import { en } from "./translations";

/** For shared UI primitives, which may render outside an I18nProvider in tests. */
export function useOptionalT(): TranslateFn {
  const ctx = useContext(I18nContext);
  return ctx?.t ?? ((key, params) => interpolate(en[key], params));
}
