import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ResultsLiveSocket } from "../live-socket";

const urls: string[] = [];

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  readyState = 0;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(url: string) {
    urls.push(url);
  }
  close() {}
}

beforeEach(() => {
  urls.length = 0;
  vi.stubGlobal("WebSocket", FakeWebSocket);
});
afterEach(() => vi.unstubAllGlobals());

describe("ResultsLiveSocket", () => {
  it("connects viewers to the plain results room", () => {
    const socket = new ResultsLiveSocket("s1", () => {});
    expect(urls[0]).toMatch(/\/results-ws\/s1$/);
    socket.destroy();
  });

  // Lobby check-ins are only sent to host sockets (backend ResultsRelay).
  it("tags the presenter's socket as host", () => {
    const socket = new ResultsLiveSocket("s1", () => {}, { role: "host" });
    expect(urls[0]).toMatch(/\/results-ws\/s1\?role=host$/);
    socket.destroy();
  });
});
