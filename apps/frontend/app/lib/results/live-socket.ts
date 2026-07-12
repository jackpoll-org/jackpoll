// ── Live-results socket (wordcloud / presentation mode) ─────────────
//
// A thin WebSocket client that listens for "updated" pings on a survey's
// results room and invokes a callback so the viewer refetches the aggregated
// counts. Mirrors the reconnect / visibility handling of the collab provider
// (app/lib/collab/provider.ts) so it survives mobile WebView suspension. The
// backend endpoint is ResultsSocket (`/results-ws/{surveyId}`); when disabled
// or unavailable, callers fall back to the existing results polling.

const RECONNECT_DELAY_MS = 2_000;

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

function resultsUrl(surveyId: string): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  // `/results-ws` (not `/results`) so the WebSocket prefix doesn't shadow any
  // frontend route — Traefik routes `/results-ws` to the backend, like
  // `/collab-ws`.
  return `${proto}://${window.location.host}/results-ws/${surveyId}`;
}

export class ResultsLiveSocket {
  private ws: WebSocket | null = null;
  private closed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly surveyId: string,
    private readonly onMessage: (data: string) => void,
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
    if (rs === WebSocket.OPEN || rs === WebSocket.CONNECTING) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.connect();
  };

  private connect = () => {
    if (this.closed) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(resultsUrl(this.surveyId));
    } catch {
      this.reconnectTimer = setTimeout(this.connect, RECONNECT_DELAY_MS);
      return;
    }
    this.ws = ws;
    ws.onmessage = (e) =>
      this.onMessage(typeof e.data === "string" ? e.data : "");
    ws.onclose = () => {
      if (this.closed) return;
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
