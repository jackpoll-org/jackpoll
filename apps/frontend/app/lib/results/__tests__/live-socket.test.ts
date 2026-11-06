import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ResultsLiveSocket } from "../live-socket";
import { AUTH_STORAGE_KEY } from "@/app/lib/auth/constants";

vi.mock("@/app/lib/auth/refresh", () => ({
  refreshAccessToken: vi.fn(async () => {
    localStorage.setItem("survey-auth-token", "fresh-token");
    return "fresh-token";
  }),
}));

const urls: string[] = [];
const protocols: (string[] | undefined)[] = [];
const sockets: { onclose: (() => void) | null }[] = [];

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  readyState = 0;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(url: string, protocolList?: string[]) {
    urls.push(url);
    protocols.push(protocolList);
    sockets.push(this);
  }
  close() {}
}

beforeEach(() => {
  urls.length = 0;
  protocols.length = 0;
  sockets.length = 0;
  localStorage.setItem(AUTH_STORAGE_KEY, "test-token");
  vi.stubGlobal("WebSocket", FakeWebSocket);
});
afterEach(() => vi.unstubAllGlobals());

describe("ResultsLiveSocket", () => {
  it("connects anonymous viewers to the plain results room", () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    const socket = new ResultsLiveSocket("s1", () => {});
    expect(urls[0]).toMatch(/\/results-ws\/s1$/);
    expect(protocols[0]).toEqual([]);
    socket.destroy();
  });

  it("carries the survey's access token for a code-protected survey", () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.setItem("survey-access-token:s1", "code-token");
    const socket = new ResultsLiveSocket("s1", () => {});
    expect(protocols[0]?.map(decodeURIComponent)).toEqual([
      "bearer-token-carrier",
      "quarkus-http-upgrade#X-Access-Token#code-token",
    ]);
    sessionStorage.removeItem("survey-access-token:s1");
    socket.destroy();
  });

  // Lobby check-ins are only sent to host sockets (backend ResultsRelay).
  it("tags the presenter's socket as host", () => {
    const socket = new ResultsLiveSocket("s1", () => {}, { role: "host" });
    expect(urls[0]).toMatch(/\/results-ws\/s1\?role=host$/);
    expect(protocols[0]?.map(decodeURIComponent)).toEqual([
      "bearer-token-carrier",
      "quarkus-http-upgrade#Authorization#Bearer test-token",
    ]);
    socket.destroy();
  });

  it("refreshes an expired token before the presenter connects", async () => {
    const expired = `x.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 60 }))}.y`;
    localStorage.setItem(AUTH_STORAGE_KEY, expired);
    const socket = new ResultsLiveSocket("s1", () => {}, { role: "host" });
    expect(urls).toHaveLength(0);
    await vi.waitFor(() => expect(urls).toHaveLength(1));
    expect(protocols[0]?.map(decodeURIComponent)).toContain(
      "quarkus-http-upgrade#Authorization#Bearer fresh-token",
    );
    socket.destroy();
  });

  it("falls back to an anonymous viewer when the server refuses the sign-in", () => {
    vi.useFakeTimers();
    const socket = new ResultsLiveSocket("s1", () => {});
    expect(protocols[0]?.map(decodeURIComponent)).toContain(
      "quarkus-http-upgrade#Authorization#Bearer test-token",
    );
    sockets[0].onclose?.();
    vi.advanceTimersByTime(2_000);
    expect(protocols[1]).toEqual([]);
    socket.destroy();
    vi.useRealTimers();
  });

  it("signs in again once when the anonymous fallback is refused, then stops", () => {
    vi.useFakeTimers();
    const socket = new ResultsLiveSocket("s1", () => {});
    const close = (i: number, code?: number) =>
      (sockets[i].onclose as ((e?: { code: number }) => void) | null)?.(code ? { code } : undefined);
    close(0);
    vi.advanceTimersByTime(2_000);
    expect(protocols[1]).toEqual([]);
    close(1, 4403);
    vi.advanceTimersByTime(2_000);
    expect(protocols[2]?.map(decodeURIComponent)).toContain(
      "quarkus-http-upgrade#Authorization#Bearer test-token",
    );
    close(2);
    vi.advanceTimersByTime(2_000);
    close(3, 4403);
    vi.advanceTimersByTime(2_000);
    expect(sockets).toHaveLength(4);
    socket.destroy();
    vi.useRealTimers();
  });
});
