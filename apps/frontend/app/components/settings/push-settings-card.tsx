"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Spinner } from "@/app/components/ui/spinner";
import { webPushSupported, subscribeWebPush } from "@/app/lib/native/web-push";
import { pushSupported, registerPush, getPushStatus } from "@/app/lib/native/push";
import { getWebPushKeyApi } from "@/app/lib/survey/api";
import { useTranslation } from "@/app/i18n/context";

type State =
  | "loading"
  | "unsupported"
  | "serverDisabled"
  | "default"
  | "granted"
  | "denied";

function permissionState(): "default" | "granted" | "denied" {
  if (typeof Notification !== "undefined") {
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
  }
  return "default";
}

export function PushSettingsCard() {
  const { t } = useTranslation();
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function resolve(): Promise<State> {
      const native = Capacitor.isNativePlatform();
      if (!webPushSupported() && !pushSupported()) return "unsupported";
      // Native has no browser Notification permission — check the actual
      // UnifiedPush registration status instead.
      if (native) {
        const status = await getPushStatus();
        return status?.registered ? "granted" : "default";
      }
      // On the web the only channel is Web Push (VAPID) — confirm the server
      // actually has it configured, otherwise enabling can never work.
      if (webPushSupported()) {
        try {
          const res = await getWebPushKeyApi();
          if (!res.data?.enabled) return "serverDisabled";
        } catch {
          return "serverDisabled";
        }
      }
      return permissionState();
    }
    void resolve().then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading" || state === "unsupported") return null;

  async function enable() {
    setBusy(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const outcome = await registerPush();
        if (outcome === "NEEDS_DISTRIBUTOR" || outcome === "UNSUPPORTED") {
          setState("default");
          toast.error(t("settings.push.denied"));
        } else {
          // Endpoint arrives async via a native listener — poll status shortly after.
          await new Promise((r) => setTimeout(r, 1500));
          const status = await getPushStatus();
          setState(status?.registered ? "granted" : "default");
          if (!status?.registered) toast.error(t("settings.push.denied"));
        }
      } else {
        await subscribeWebPush();
        const next = permissionState();
        setState(next);
        if (next !== "granted") toast.error(t("settings.push.denied"));
      }
    } catch {
      toast.error(t("settings.push.denied"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("settings.section.notifications")}</CardTitle>
        <CardDescription>{t("settings.push.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {state === "serverDisabled" ? (
          <p className="text-sm text-muted-foreground">{t("settings.push.unavailable")}</p>
        ) : state === "granted" ? (
          <p className="text-sm text-muted-foreground">{t("settings.push.enabled")}</p>
        ) : state === "denied" ? (
          <p className="text-sm text-muted-foreground">{t("settings.push.blocked")}</p>
        ) : (
          <Button onClick={enable} disabled={busy}>
            {busy && <Spinner className="size-4" />}
            {t("settings.push.enable")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
