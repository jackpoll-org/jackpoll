"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Fingerprint } from "lucide-react";
import { App } from "@capacitor/app";
import { Button } from "@/app/components/ui/button";
import { Spinner } from "@/app/components/ui/spinner";
import { AUTH_STORAGE_KEY } from "@/app/lib/auth/constants";
import {
  BIOMETRIC_IDLE_MS,
  biometricEnabled,
  biometricSupported,
  biometricUnlockedRecently,
  markBiometricUnlocked,
  verifyIdentity,
} from "@/app/lib/native/biometric";
import { hImpact } from "@/app/lib/native/haptics";
import { useTranslation } from "@/app/i18n/context";

/**
 * Native-only biometric gate (mobile #54): require Face ID / fingerprint before
 * showing protected content when a stored session exists and the user has the
 * setting enabled. Re-locks when the app returns from the background after an
 * idle period. On the web — or without a session / enrolled biometrics — it
 * renders its children unchanged.
 */
export function BiometricLock({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  const shouldGate = useCallback(() => {
    const hasSession =
      typeof localStorage !== "undefined" &&
      !!localStorage.getItem(AUTH_STORAGE_KEY);
    return biometricSupported() && biometricEnabled() && hasSession;
  }, []);

  const unlock = useCallback(async () => {
    setChecking(true);
    const ok = await verifyIdentity(t("biometric.reason"));
    setChecking(false);
    setLocked(!ok);
    if (ok) {
      markBiometricUnlocked();
      void hImpact();
    }
  }, [t]);

  // Initial gate on mount — but skip if a recent unlock (the restore prompt or a
  // prior screen this session) already verified within the idle window, so
  // navigating back here (logo, language switch) doesn't re-prompt.
  useEffect(() => {
    if (!shouldGate() || biometricUnlockedRecently()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocked(true);
    void unlock();
  }, [shouldGate, unlock]);

  // Re-lock when resuming after being backgrounded long enough.
  useEffect(() => {
    if (!biometricSupported()) return;
    let remove: (() => void) | undefined;
    App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) {
        backgroundedAt.current = Date.now();
        return;
      }
      const since = backgroundedAt.current;
      backgroundedAt.current = null;
      if (since && Date.now() - since >= BIOMETRIC_IDLE_MS && shouldGate()) {
        setLocked(true);
        void unlock();
      }
    })
      .then((handle) => {
        remove = () => void handle.remove();
      })
      .catch(() => {});
    return () => remove?.();
  }, [shouldGate, unlock]);

  if (!locked) return <>{children}</>;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
      <Fingerprint className="size-12 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{t("biometric.locked")}</p>
      <Button onClick={unlock} disabled={checking}>
        {checking && <Spinner className="size-4" />}
        {t("biometric.unlock")}
      </Button>
    </div>
  );
}
