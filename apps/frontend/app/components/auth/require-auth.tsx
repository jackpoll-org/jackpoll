"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/app/components/auth/auth-provider";
import { Button } from "@/app/components/ui/button";
import { Spinner } from "@/app/components/ui/spinner";
import { authKeys } from "@/app/lib/auth/constants";
import {
  biometricEnabled,
  biometricSupported,
  markBiometricUnlocked,
  verifyIdentity,
} from "@/app/lib/native/biometric";
import { hasOfflineToken } from "@/app/lib/native/secure-session";
import { hImpact } from "@/app/lib/native/haptics";
import { restoreWithOfflineToken } from "@/app/lib/auth/restore";
import { useTranslation } from "@/app/i18n/context";

interface RequireAuthProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// Whether the (expired) session can be restored with biometrics on this device.
type Restore = "deciding" | "available" | "none";

/**
 * Wraps children and gates access to authenticated users.
 *
 * On the web (and when no biometric session is stored), unauthenticated users
 * are redirected to `/login`. In the native app, if a biometric-protected
 * offline token exists, an "unlock to continue" screen is shown instead so the
 * user can restore an expired session with Face ID / fingerprint — no password.
 */
export function RequireAuth({ children, fallback }: RequireAuthProps) {
  const { isAuthenticated, isLoading } = useAuthContext();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [restore, setRestore] = useState<Restore>("deciding");
  const [unlocking, setUnlocking] = useState(false);
  const promptedRef = useRef(false);

  // Decide once (per unauthenticated visit) whether to redirect or offer unlock.
  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    let cancelled = false;
    void (async () => {
      const canRestore =
        biometricSupported() &&
        biometricEnabled() &&
        (await hasOfflineToken());
      if (cancelled) return;
      if (canRestore) {
        setRestore("available");
      } else {
        setRestore("none");
        router.replace("/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated, router]);

  const unlock = useCallback(async () => {
    setUnlocking(true);
    const verified = await verifyIdentity(t("biometric.reason"));
    if (verified && (await restoreWithOfflineToken())) {
      // This verification also satisfies the lock gate (BiometricLock) the
      // dashboard mounts next, so it won't immediately re-prompt.
      markBiometricUnlocked();
      void hImpact();
      // The /me query re-runs now that a fresh token is stored.
      await queryClient.invalidateQueries({ queryKey: authKeys.all });
      setUnlocking(false);
      return;
    }
    setUnlocking(false);
    // A genuine restore failure (revoked/expired token) → fall back to password.
    if (verified) router.replace("/login");
  }, [t, queryClient, router]);

  // Auto-prompt once when an unlock becomes available.
  useEffect(() => {
    if (restore === "available" && !promptedRef.current) {
      promptedRef.current = true;
      void unlock();
    }
  }, [restore, unlock]);

  if (isAuthenticated) return <>{children}</>;

  if (isLoading || restore === "deciding" || restore === "none") {
    return (
      fallback ?? (
        <div className="flex flex-1 items-center justify-center py-32">
          <Spinner className="size-8 text-muted-foreground" />
        </div>
      )
    );
  }

  // restore === "available": biometric unlock screen.
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
      <Fingerprint className="size-12 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-lg font-medium">{t("biometric.restoreTitle")}</p>
        <p className="text-sm text-muted-foreground">
          {t("biometric.restoreHint")}
        </p>
      </div>
      <Button onClick={unlock} disabled={unlocking}>
        {unlocking && <Spinner className="size-4" />}
        {t("biometric.unlock")}
      </Button>
      <Button
        variant="ghost"
        onClick={() => router.replace("/login")}
        disabled={unlocking}
      >
        {t("biometric.usePassword")}
      </Button>
    </div>
  );
}
