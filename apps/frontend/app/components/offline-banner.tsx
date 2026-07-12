"use client";

import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { Network } from "@capacitor/network";
import { queuedCount } from "@/app/lib/survey/offline-queue";
import { useTranslation } from "@/app/i18n/context";

/**
 * App-wide connectivity banner (mobile #53). Shows when offline, and — once
 * back online — how many saved responses are still waiting to sync. Hidden when
 * online with an empty outbox.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (typeof navigator !== "undefined") setOnline(navigator.onLine);
      const count = await queuedCount();
      if (active) setPending(count);
    };
    void refresh();

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    // Poll the outbox so the count reflects background syncing.
    const timer = window.setInterval(refresh, 5000);

    let removeNative: (() => void) | undefined;
    Network.addListener("networkStatusChange", (s) => setOnline(s.connected))
      .then((h) => {
        removeNative = () => void h.remove();
      })
      .catch(() => {});

    return () => {
      active = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(timer);
      removeNative?.();
    };
  }, []);

  if (online && pending === 0) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-primary px-4 py-1.5 text-center text-xs font-medium text-primary-foreground"
    >
      {!online ? (
        <>
          <CloudOff className="size-3.5 shrink-0" />
          {t("offline.banner")}
        </>
      ) : (
        <>
          <RefreshCw className="size-3.5 shrink-0 animate-spin" />
          {t("offline.pending", { count: pending })}
        </>
      )}
    </div>
  );
}
