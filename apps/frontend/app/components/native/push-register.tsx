"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { registerPush, onPushRegistrationFailed } from "@/app/lib/native/push";
import { subscribeWebPush } from "@/app/lib/native/web-push";
import { useTranslation } from "@/app/i18n/context";

/**
 * Registers the device for push notifications once, inside the authenticated
 * area. Native (mobile) uses FCM/APNs; browsers use Web Push (#74). Both are
 * best-effort and no-op when unsupported; renders nothing.
 */
export function PushRegister() {
  const { t } = useTranslation();
  useEffect(() => {
    void registerPush();
    void subscribeWebPush();
    return onPushRegistrationFailed((reason) => {
      toast.error(`${t("push.setup.registrationFailed")} (${reason})`);
    });
  }, [t]);
  return null;
}
