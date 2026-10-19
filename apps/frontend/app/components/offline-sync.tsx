"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Network } from "@capacitor/network";
import { listQueued, removeQueued } from "@/app/lib/survey/offline-queue";
import { ApiError, submitResponseApi } from "@/app/lib/survey/api";
import { validCaptcha } from "@/app/lib/survey/captcha";
import { useTranslation } from "@/app/i18n/context";

// Module-level guard so overlapping triggers (online event + Capacitor network
// change + mount) never drain the queue concurrently.
let draining = false;

async function drainQueue(
  onSynced: (count: number) => void,
  onRejected: (count: number) => void,
): Promise<void> {
  if (draining) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  draining = true;
  try {
    const items = await listQueued();
    let synced = 0;
    let rejected = 0;
    for (const item of items) {
      try {
        const payload = item.payload.captcha
          ? { ...item.payload, captcha: await validCaptcha(item.surveyId, item.payload.captcha) }
          : item.payload;
        const res = await submitResponseApi(item.surveyId, payload, item.accessToken);
        if (res.success) {
          await removeQueued(item.id);
          synced += 1;
        }
      } catch (e) {
        // The server refused it for good (closed survey, revoked code, invalid answer): drop it and tell
        // the user. Rate limits and server errors are retried; a network error means offline again.
        if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) {
          await removeQueued(item.id);
          rejected += 1;
          continue;
        }
        if (e instanceof ApiError) continue;
        break;
      }
    }
    if (synced > 0) onSynced(synced);
    if (rejected > 0) onRejected(rejected);
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
    const onRejected = (count: number) =>
      toast.error(t("offline.rejected", { count }));
    const run = () => void drainQueue(onSynced, onRejected);

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
