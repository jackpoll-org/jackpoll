"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Returns false during SSR and the first hydration render, then true on the
 * client. Use to defer rendering of client-only / localStorage-dependent UI
 * without a server/client hydration mismatch — and without calling setState
 * inside an effect.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
