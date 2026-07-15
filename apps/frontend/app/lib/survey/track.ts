import { API_BASE_URL } from "@/app/lib/auth/constants";
import { SURVEY_ENDPOINTS } from "./constants";

export type TrackEvent = "view" | "start" | "submit";

function detectDevice(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
  return "desktop";
}

/**
 * Real external referrer only. Same-origin navigations (opening a form from
 * inside the Jackpoll app — dashboard preview, share link click) would otherwise
 * report our own host as the "source", so we collapse them to direct (undefined).
 */
function externalReferrer(): string | undefined {
  const ref = document.referrer;
  if (!ref) return undefined;
  try {
    return new URL(ref).host === window.location.host ? undefined : ref;
  } catch {
    return undefined;
  }
}

/**
 * Cookieless, fire-and-forget analytics beacon (issue #34). Sends only a
 * coarse event with a normalized referrer/UTM/device — no cookies, no
 * identifiers, no personal data — so no consent banner is required.
 */
export function trackEvent(surveyId: string, event: TrackEvent): void {
  if (typeof window === "undefined") return;

  const body: Record<string, unknown> = { event };
  if (event === "view") {
    body.referrer = externalReferrer();
    body.utmSource =
      new URLSearchParams(window.location.search).get("utm_source") || undefined;
    body.device = detectDevice();
  }

  void fetch(`${API_BASE_URL}${SURVEY_ENDPOINTS.track(surveyId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {
    // analytics must never affect the respondent experience
  });
}
