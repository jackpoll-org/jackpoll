"use client";

import { useCallback, useEffect, useState } from "react";
import { getCookie, setCookie } from "@/app/lib/cookies";

type Backend = "localStorage" | "cookie";

interface PreferenceOptions<T> {
  key: string;
  defaultValue: T;
  /** Where the value is persisted. Defaults to localStorage. */
  backend?: Backend;
  serialize?: (value: T) => string;
  deserialize?: (raw: string) => T;
  /**
   * Cookie backend only: mirror the value to `document.body` as a presence
   * attribute (set when truthy, removed when falsy) so CSS can react instantly.
   */
  bodyAttr?: string;
}

/**
 * Persisted client preference with a hydration-safe read. Returns
 * `[value, setValue, ready]`; `ready` flips true after the first effect resolves
 * the stored value, so consumers can defer rendering to avoid SSR/client
 * mismatch — the same pattern the native toggles use today.
 */
export function usePreference<T>(
  opts: PreferenceOptions<T>,
): [T, (value: T) => void, boolean] {
  const { key, defaultValue, backend = "localStorage", serialize, deserialize, bodyAttr } = opts;
  const [value, setValue] = useState<T>(defaultValue);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw =
      backend === "cookie"
        ? getCookie(key)
        : typeof localStorage !== "undefined"
          ? localStorage.getItem(key)
          : null;
    if (raw !== null) {
      try {
        // Resolve the persisted value once after mount (hydration-safe).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setValue(deserialize ? deserialize(raw) : (raw as unknown as T));
      } catch {
        // Corrupt value — keep the default.
      }
    }
    setReady(true);
    // key/backend identify the store; serializers are stable by construction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, backend]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      const raw = serialize ? serialize(next) : String(next);
      if (backend === "cookie") {
        setCookie(key, raw);
        if (bodyAttr && typeof document !== "undefined") {
          if (next) document.body.setAttribute(bodyAttr, "");
          else document.body.removeAttribute(bodyAttr);
        }
      } else if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, raw);
      }
    },
    [key, backend, serialize, bodyAttr],
  );

  return [value, update, ready];
}
