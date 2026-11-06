// ── Live-results socket (wordcloud / presentation mode) ─────────────
//
// A thin WebSocket client that listens for "updated" pings on a survey's
// results room and invokes a callback so the viewer refetches the aggregated
// counts. Mirrors the reconnect / visibility handling of the collab provider
// (app/lib/collab/provider.ts) so it survives mobile WebView suspension. The
// backend endpoint is ResultsSocket (`/results-ws/{surveyId}`); when disabled
// or unavailable, callers fall back to the existing results polling.

import { refreshAccessToken } from "@/app/lib/auth/refresh";
import { getStoredToken, storedTokenExpired } from "@/app/lib/auth/storage";
import { accessTokenFor, resumeToken } from "@/app/lib/survey/api";

const RECONNECT_DELAY_MS = 2_000;
const FORBIDDEN = 4403;

/**
 * Whether live results push is enabled for this instance. Read at runtime from
 * a flag the server injects (`window.__LIVE_RESULTS_ENABLED__`, from the
 * LIVE_RESULTS_ENABLED env var) so self-hosters can toggle it without a
 * rebuild; falls back to the build-time NEXT_PUBLIC_LIVE_RESULTS_ENABLED, and
 * defaults to on.
 */
export function liveResultsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { __LIVE_RESULTS_ENABLED__?: boolean };
  if (typeof w.__LIVE_RESULTS_ENABLED__ === "boolean") {
    return w.__LIVE_RESULTS_ENABLED__;
  }
  // Default on unless explicitly disabled.
  return process.env.NEXT_PUBLIC_LIVE_RESULTS_ENABLED !== "false";
}

export interface ResultsLiveSocketOptions {
  /**
   * "host" = the live presenter. Host sockets also receive host-only messages
   * (lobby check-ins), which the backend keeps off every player's phone.
   */
  role?: "host";
}

function resultsUrl(surveyId: string, role?: "host"): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  // `/results-ws` (not `/results`) so the WebSocket prefix doesn't shadow any
  // frontend route — Traefik routes `/results-ws` to the backend, like
  // `/collab-ws`.
  const query = role ? `?role=${role}` : "";
  return `${proto}://${window.location.host}/results-ws/${surveyId}${query}`;
}

/**
 * Browsers can't set headers on a WebSocket, so the credentials ride in the
 * sub-protocol: the bearer token for members (lobby check-ins, unpublished
 * surveys) and the access or resume token for a code-protected survey.
 */
function credentialProtocols(surveyId: string, withBearer: boolean): string[] {
  const token = withBearer ? getStoredToken() : null;
  const access = accessTokenFor(surveyId);
  const resume = resumeToken();
  const credentials = [
    ...(token ? [`Authorization#Bearer ${token}`] : []),
    ...(access ? [`X-Access-Token#${access}`] : []),
    ...(resume ? [`X-Resume-Token#${resume}`] : []),
  ];
  return credentials.length
    ? ["bearer-token-carrier", ...credentials.map((c) => encodeURIComponent(`quarkus-http-upgrade#${c}`))]
    : [];
}

export class ResultsLiveSocket {
  private ws: WebSocket | null = null;
  private closed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** A viewer whose sign-in the server refused still follows a published survey anonymously. */
  private withBearer = true;
  private retriedBearer = false;

  constructor(
    private readonly surveyId: string,
    private readonly onMessage: (data: string) => void,
    private readonly options: ResultsLiveSocketOptions = {},
  ) {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.onVisible);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("focus", this.onVisible);
      window.addEventListener("online", this.onVisible);
    }
    this.connect();
  }

  private onVisible = () => {
    if (this.closed) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    const rs = this.ws?.readyState;
    // Don't interrupt an in-flight connection attempt.
    if (rs === WebSocket.CONNECTING) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    // A socket the browser still reports as OPEN can be a zombie — dead but
    // never sent a close/error frame (locked screen, flaky mobile network,
    // carrier NAT timeout). Force-drop and reopen it rather than trusting
    // readyState, so a phone waking up always gets a fresh connection.
    if (rs === WebSocket.OPEN && this.ws) {
      this.ws.onclose = null; // don't also trigger the automatic reconnect-on-close path
      this.ws.onerror = null;
      this.ws.close();
    }
    this.connect();
  };

  private connect = (refreshed = false) => {
    if (this.closed) return;
    // An expired bearer token fails the upgrade with 401 on every retry, so refresh it first.
    if (getStoredToken() && !refreshed && storedTokenExpired()) {
      void refreshAccessToken().finally(() => this.connect(true));
      return;
    }
    let ws: WebSocket;
    try {
      ws = new WebSocket(
        resultsUrl(this.surveyId, this.options.role),
        credentialProtocols(this.surveyId, this.withBearer),
      );
    } catch {
      this.reconnectTimer = setTimeout(this.connect, RECONNECT_DELAY_MS);
      return;
    }
    this.ws = ws;
    let opened = false;
    ws.onopen = () => {
      opened = true;
      if (this.withBearer) this.retriedBearer = false;
    };
    ws.onmessage = (e) =>
      this.onMessage(typeof e.data === "string" ? e.data : "");
    ws.onclose = (e) => {
      if (this.closed) return;
      if (e?.code === FORBIDDEN) {
        // A failed attempt before open can be the network, not a refused sign-in:
        // when the anonymous fallback is refused, try signed in once more.
        if (this.withBearer || this.retriedBearer || !getStoredToken()) return;
        this.withBearer = true;
        this.retriedBearer = true;
      } else if (!opened && !this.options.role && getStoredToken()) {
        this.withBearer = false;
      }
      this.reconnectTimer = setTimeout(this.connect, RECONNECT_DELAY_MS);
    };
    ws.onerror = () => ws.close();
  };

  destroy(): void {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisible);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", this.onVisible);
      window.removeEventListener("online", this.onVisible);
    }
    this.ws?.close();
    this.ws = null;
  }
}
