"use client";

import { useEffect } from "react";
import { resumePushRegistration } from "@/app/lib/native/push";
import { subscribeWebPush } from "@/app/lib/native/web-push";

/**
 * Refreshes an existing push registration once the user is signed in, so a
 * rotated token reaches the backend. Renders nothing.
 *
 * Deliberately silent and permission-free:
 *
 * * It must not ask for anything. iOS shows the notification prompt once per
 *   install; spending it the moment someone signs in, with no explanation,
 *   wastes it — the only way back is the Settings app. Asking belongs to
 *   Settings → Notifications, where the user chose to turn push on.
 * * It must not report failures. A device that never registered fails here
 *   every single start (an iOS build without the aps-environment entitlement,
 *   an Android phone with no distributor), and a red toast about a feature the
 *   user never enabled is noise. The Settings screen surfaces the reason when
 *   it is actually relevant.
 */
export function PushRegister() {
  useEffect(() => {
    void resumePushRegistration();
    void subscribeWebPush();
  }, []);
  return null;
}
