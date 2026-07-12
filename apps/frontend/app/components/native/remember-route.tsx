"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { rememberLastPath } from "@/app/lib/native/instance";

/**
 * Persists the current in-app route to native Preferences (issue #94 follow-up)
 * so the mobile picker can restore it after a relaunch/reload instead of always
 * dropping the user on the dashboard. No-op on the web (rememberLastPath bails
 * when not running natively). Renders nothing.
 */
export function RememberRoute() {
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    const query = params.toString();
    void rememberLastPath(query ? `${pathname}?${query}` : pathname);
  }, [pathname, params]);

  return null;
}
