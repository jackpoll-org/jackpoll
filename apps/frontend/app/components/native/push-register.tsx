"use client";

import { useEffect } from "react";
import { registerPush } from "@/app/lib/native/push";
import { subscribeWebPush } from "@/app/lib/native/web-push";

/**
 * Registers the device for push notifications once, inside the authenticated
 * area. Native (mobile) uses FCM/APNs; browsers use Web Push (#74). Both are
 * best-effort and no-op when unsupported; renders nothing.
 */
export function PushRegister() {
  useEffect(() => {
    void registerPush();
    void subscribeWebPush();
  }, []);
  return null;
}
