"use client";

import { useCallback, useEffect, useRef } from "react";
import { collabEnabled, type FocusState } from "@/app/lib/collab/provider";
import { useBuilder } from "./builder-context";

const BLUR_CLEAR_MS = 150;

/**
 * Publishes which field this client is editing to collaborators (issue #85).
 * Returns `onFocus`/`onBlur` handlers to spread onto an input. Clearing on blur
 * is debounced so tabbing between fields doesn't flicker the remote highlight.
 * No-ops when live collaboration is disabled.
 */
export function useFieldFocus(target: FocusState): {
  onFocus?: () => void;
  onBlur?: () => void;
} {
  const { setFocus } = useBuilder();
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep the latest target without re-creating handlers each render.
  const targetRef = useRef(target);
  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  useEffect(() => {
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, []);

  const onFocus = useCallback(() => {
    if (clearTimer.current) {
      clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
    setFocus(targetRef.current);
  }, [setFocus]);

  const onBlur = useCallback(() => {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setFocus(null), BLUR_CLEAR_MS);
  }, [setFocus]);

  if (!collabEnabled()) return {};
  return { onFocus, onBlur };
}
