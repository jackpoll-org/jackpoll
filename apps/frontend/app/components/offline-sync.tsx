"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Network } from "@capacitor/network";
import { listQueued, removeQueued } from "@/app/lib/survey/offline-queue";
import { submitResponseApi } from "@/app/lib/survey/api";
import { useTranslation } from "@/app/i18n/context";

// Module-level guard so overlapping triggers (online event + Capacitor network
// change + mount) never drain the queue concurrently.
let draining = false;

async function drainQueue(onSynced: (count: number) => void): Promise<void> {
  if (draining) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  draining = true;
  try {
    const items = await listQueued();
    let synced = 0;
    for (const item of items) {
      try {
        const res = await submitResponseApi(item.surveyId, item.payload);
        if (res.success) {
          await removeQueued(item.id);
          synced += 1;
        } else {
          break; // server rejected → stop; keep the rest for a later retry
        }
      } catch {
        break; // still offline / server unreachable → retry on the next trigger
      }
    }
    if (synced > 0) onSynced(synced);
  } finally {
    draining = false;
  }
}

/**
 * Flushes the offline response outbox (phase 2) whenever connectivity returns —
 * on mount, the browser `online` event, and Capacitor's network change. Renders
 * nothing.
 */
export function OfflineSync() {
  const { t } = useTranslation();

  useEffect(() => {
    const onSynced = (count: number) =>
      toast.success(t("offline.synced", { count }));
    const run = () => void drainQueue(onSynced);

    run();
    window.addEventListener("online", run);

    let removeNative: (() => void) | undefined;
    Network.addListener("networkStatusChange", (status) => {
      if (status.connected) run();
    })
      .then((handle) => {
        removeNative = () => void handle.remove();
      })
      .catch(() => {
        // Network plugin unavailable on plain web — the `online` event covers it.
      });

    return () => {
      window.removeEventListener("online", run);
      removeNative?.();
    };
  }, [t]);

  return null;
}
