"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";

/**
 * Map an incoming deep-link URL to the in-app path to navigate to, or null when
 * it can't be parsed or points at the app root (nothing to route). Keeps query
 * and hash because email/share tokens live there.
 */
export function deepLinkPath(url: string): string | null {
  try {
    const parsed = new URL(url);
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return path && path !== "/" ? path : null;
  } catch {
    return null;
  }
}

/**
 * Routes incoming deep links / universal links into the app (#71). When the OS
 * opens the app for a matched URL (a shared survey `/s/<token>`, an email
 * verify/reset link, etc.), Capacitor fires `appUrlOpen`; we strip the origin
 * and navigate the in-app router to the path so the right screen loads instead
 * of a cold home screen. Native-only; renders nothing.
 */
export function DeepLinks() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let remove: (() => void) | undefined;
    let cancelled = false;

    void import("@capacitor/app").then(({ App }) => {
      const handle = App.addListener("appUrlOpen", ({ url }) => {
        // Only the in-app path matters — the WebView already lives on the
        // instance origin.
        const path = deepLinkPath(url);
        if (path) router.push(path);
      });
      // addListener resolves to the handle; store its remover.
      void handle.then((h) => {
        if (cancelled) void h.remove();
        else remove = () => void h.remove();
      });
    });

    return () => {
      cancelled = true;
      remove?.();
    };
  }, [router]);

  return null;
}
