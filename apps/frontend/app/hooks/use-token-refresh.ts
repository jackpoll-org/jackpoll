"use client";

import { useEffect, useRef } from "react";
import { getStoredToken, jwtExpiryMs } from "@/app/lib/auth/storage";
import { refreshAccessToken } from "@/app/lib/auth/refresh";

/** Refresh this many ms before the access token actually expires. */
const REFRESH_MARGIN_MS = 60_000;

/**
 * Proactively refreshes the access token shortly before it expires, so a
 * logged-in user never hits an avoidable 401 mid-action (issue #35). Pass the
 * current auth state so the schedule (re)starts when the user logs in.
 */
export function useTokenRefresh(active: boolean): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) return;

    function schedule(): void {
      if (timer.current) clearTimeout(timer.current);
      const token = getStoredToken();
      if (!token) return;
      const exp = jwtExpiryMs(token);
      if (!exp) return;
      const delay = Math.max(1000, exp - Date.now() - REFRESH_MARGIN_MS);
      timer.current = setTimeout(() => {
        void refreshAccessToken().then((next) => {
          if (next) schedule(); // reschedule against the new token's expiry
        });
      }, delay);
    }

    schedule();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [active]);
}
