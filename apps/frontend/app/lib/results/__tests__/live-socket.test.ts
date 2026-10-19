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

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  readyState = 0;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(url: string, protocolList?: string[]) {
    urls.push(url);
    protocols.push(protocolList);
  }
  close() {}
}

beforeEach(() => {
  urls.length = 0;
  protocols.length = 0;
  localStorage.setItem(AUTH_STORAGE_KEY, "test-token");
  vi.stubGlobal("WebSocket", FakeWebSocket);
});
afterEach(() => vi.unstubAllGlobals());

describe("ResultsLiveSocket", () => {
  it("connects viewers to the plain results room", () => {
    const socket = new ResultsLiveSocket("s1", () => {});
    expect(urls[0]).toMatch(/\/results-ws\/s1$/);
    expect(protocols[0]).toEqual([]);
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
});
