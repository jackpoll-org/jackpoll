"use client";

import { useEffect, useEffectEvent } from "react";

const SAVE_DELAY_MS = 800;

export function useSaveAfterPause(text: string, enabled: boolean, save: () => void) {
  const saveNow = useEffectEvent(save);
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(saveNow, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, enabled]);
}
