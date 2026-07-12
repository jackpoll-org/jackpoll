"use client";

import { useEffect, useRef, type ElementType } from "react";

interface AltchaWidgetProps {
  /** URL the widget fetches its proof-of-work challenge from. */
  challengeUrl: string;
  /** Called with the solved payload (base64) or null when reset/failed. */
  onVerified: (payload: string | null) => void;
}

/**
 * Thin wrapper around the Altcha web component (issue #31). Altcha is a
 * privacy-friendly, self-hosted proof-of-work CAPTCHA — no third-party calls,
 * no cookies, GDPR-safe.
 */
export function AltchaWidget({ challengeUrl, onVerified }: AltchaWidgetProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    // Register the custom element on the client only.
    void import("altcha");
    const el = ref.current;
    if (!el) return;

    function handleState(event: Event) {
      const detail = (event as CustomEvent<{ state: string; payload?: string }>)
        .detail;
      if (detail?.state === "verified" && detail.payload) {
        onVerified(detail.payload);
      } else {
        onVerified(null);
      }
    }

    el.addEventListener("statechange", handleState);
    return () => el.removeEventListener("statechange", handleState);
  }, [onVerified]);

  // `altcha-widget` is a custom element; ElementType keeps props loosely typed.
  // Altcha v3 renamed the `challengeurl` attribute to `challenge` (a URL string
  // makes the widget fetch a fresh proof-of-work challenge from that endpoint).
  const Tag = "altcha-widget" as ElementType;
  return <Tag ref={ref} challenge={challengeUrl} />;
}
