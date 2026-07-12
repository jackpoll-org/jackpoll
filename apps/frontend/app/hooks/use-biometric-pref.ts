"use client";

import { useEffect, useState } from "react";
import {
  biometricEnabled,
  biometricSupported,
  setBiometricEnabled,
} from "@/app/lib/native/biometric";
import { clearOfflineToken } from "@/app/lib/native/secure-session";
import { hSelection } from "@/app/lib/native/haptics";

/**
 * Shared biometric-unlock on/off state (mobile #54), resolved after mount.
 * Disabling clears the stored offline token so the session can't be restored
 * without a password.
 */
export function useBiometricPref() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(biometricSupported());
    setEnabledState(biometricEnabled());
  }, []);

  function setEnabled(on: boolean) {
    setEnabledState(on);
    setBiometricEnabled(on);
    void hSelection();
    if (!on) void clearOfflineToken();
  }

  return { supported, enabled, setEnabled };
}
