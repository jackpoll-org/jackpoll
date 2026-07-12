"use client";

import { useEffect, useState } from "react";
import {
  hapticsEnabled,
  hapticsSupported,
  hSelection,
  setHapticsEnabled,
} from "@/app/lib/native/haptics";

/**
 * Shared haptics on/off state, resolved after mount to avoid a hydration
 * mismatch. Used by both the (legacy) dropdown item and the Settings Device row.
 */
export function useHapticsPref() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(hapticsSupported());
    setEnabledState(hapticsEnabled());
  }, []);

  function setEnabled(on: boolean) {
    setEnabledState(on);
    setHapticsEnabled(on);
    if (on) void hSelection(); // tick so the user feels it turn on
  }

  return { supported, enabled, setEnabled };
}
