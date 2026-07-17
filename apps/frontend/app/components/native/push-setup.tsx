"use client";

// Shared UnifiedPush onboarding UI for BOTH Android flavors (play + fdroid).
// Shows registration status, the active distributor, and lets the user switch
// distributor, re-register, or unregister. When no distributor is installed
// (typical on the F-Droid build) it explains how to get one.

import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Spinner } from "@/app/components/ui/spinner";
import { useTranslation } from "@/app/i18n/context";
import {
  pushSupported,
  registerPush,
  unregisterPush,
  getPushStatus,
  listPushDistributors,
  pickPushDistributor,
  onPushRegistrationFailed,
  type PushStatus,
} from "@/app/lib/native/push";

export function PushSetup() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [distributors, setDistributors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [needsDistributor, setNeedsDistributor] = useState(false);

  const refresh = useCallback(async () => {
    setStatus(await getPushStatus());
    setDistributors(await listPushDistributors());
  }, []);

  useEffect(() => {
    if (!pushSupported()) return;
    void refresh();
    return onPushRegistrationFailed((reason) => {
      toast.error(`${t("push.setup.registrationFailed")} (${reason})`);
      void refresh();
    });
  }, [refresh, t]);

  if (!pushSupported()) return null;

  async function enable() {
    setBusy(true);
    setNeedsDistributor(false);
    try {
      const outcome = await registerPush();
      if (outcome === "NEEDS_DISTRIBUTOR") setNeedsDistributor(true);
      if (outcome === "NEEDS_PICKER") await refresh(); // show the picker below
      // endpoint arrives async via the listener → poll status shortly after.
      setTimeout(() => void refresh(), 1500);
    } catch {
      toast.error(t("push.setup.error"));
    } finally {
      setBusy(false);
    }
  }

  async function choose(distributor: string) {
    setBusy(true);
    try {
      await pickPushDistributor(distributor);
      setTimeout(() => void refresh(), 1500);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      await unregisterPush();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const registered = status?.registered ?? false;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{t("push.setup.status")}</span>
        <span className={`text-sm ${registered ? "text-green-600" : "text-muted-foreground"}`}>
          {registered ? t("push.setup.registered") : t("push.setup.notRegistered")}
        </span>
      </div>

      {status?.distributor && (
        <p className="text-sm text-muted-foreground">
          {t("push.setup.activeDistributor")}: <code>{status.distributor}</code>
        </p>
      )}

      {/* Picker: shown when several distributors are installed. */}
      {distributors.length > 1 && (
        <div className="space-y-1">
          <p className="text-sm">{t("push.setup.chooseDistributor")}</p>
          <div className="flex flex-wrap gap-2">
            {distributors.map((d) => (
              <Button key={d} size="sm" variant="outline" disabled={busy} onClick={() => choose(d)}>
                {d === Capacitor.getPlatform() ? t("push.setup.embedded") : d}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* No distributor installed (common on F-Droid without Play Services). */}
      {needsDistributor && (
        <p className="text-sm text-muted-foreground">
          {t("push.setup.noDistributor")}{" "}
          <a
            className="underline"
            href="https://unifiedpush.org/users/distributors/"
            target="_blank"
            rel="noreferrer"
          >
            unifiedpush.org
          </a>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {!registered ? (
          <Button onClick={enable} disabled={busy}>
            {busy && <Spinner className="size-4" />}
            {t("push.setup.enable")}
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={enable} disabled={busy}>
              {t("push.setup.reregister")}
            </Button>
            <Button variant="ghost" onClick={disable} disabled={busy}>
              {t("push.setup.disable")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
