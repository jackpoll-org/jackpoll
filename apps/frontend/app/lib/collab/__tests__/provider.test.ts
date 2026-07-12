import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as Y from "yjs";
import { Awareness, encodeAwarenessUpdate } from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

import { CollabProvider } from "../provider";
import { applyContentToDoc, docToContent, type CollabContent } from "../doc";

const MSG_AWARENESS = 1;

const content = (title: string): CollabContent => ({
  title,
  description: "",
  status: "draft",
  settings: {} as CollabContent["settings"],
  questions: [],
  sections: [],
});

/** Shuttle sent frames between two sockets until the exchange settles. */
function pump(a: MockWebSocket, b: MockWebSocket): void {
  let ia = 0;
  let ib = 0;
  for (let round = 0; round < 12; round++) {
    const na = a.sent.slice(ia);
    const nb = b.sent.slice(ib);
    ia = a.sent.length;
    ib = b.sent.length;
    na.forEach((f) => b.deliver(f));
    nb.forEach((f) => a.deliver(f));
    if (na.length === 0 && nb.length === 0) break;
  }
}

// ── Minimal WebSocket double ──────────────────────────────────────
//
// The provider only uses: construction, binaryType, onopen/onmessage/onclose/
// onerror, readyState, send, close. We capture sent frames and let tests drive
// the lifecycle (open, inbound message) deterministically.

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;

  binaryType = "";
  readyState = 0;
  sent: Uint8Array[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: ArrayBuffer }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  send(data: Uint8Array) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  deliver(frame: Uint8Array) {
    this.onmessage?.({ data: frame.buffer.slice(0) as ArrayBuffer });
  }
}

/** Count how many of the captured frames are awareness messages. */
function awarenessFrames(ws: MockWebSocket): number {
  return ws.sent.filter((f) => {
    const d = decoding.createDecoder(f);
    return decoding.readVarUint(d) === MSG_AWARENESS;
  }).length;
}

/** Build a wire frame announcing a foreign peer's awareness state. */
function remotePeerFrame(name: string): Uint8Array {
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  awareness.setLocalStateField("user", { name, color: "#abc" });
  const update = encodeAwarenessUpdate(awareness, [doc.clientID]);
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, MSG_AWARENESS);
  encoding.writeVarUint8Array(enc, update);
  return encoding.toUint8Array(enc);
}

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
  vi.stubGlobal("location", { protocol: "https:", host: "example.com" } as Location);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("CollabProvider presence convergence", () => {
  it("announces presence on connect", () => {
    const provider = new CollabProvider("survey-1", { name: "Host", color: "#111" });
    const ws = MockWebSocket.instances[0];
    ws.open();

    expect(awarenessFrames(ws)).toBeGreaterThanOrEqual(1);
    provider.destroy();
  });

  it("re-announces on a heartbeat so late joiners still see us", () => {
    vi.useFakeTimers();
    const provider = new CollabProvider("survey-1", { name: "Host", color: "#111" });
    const ws = MockWebSocket.instances[0];
    ws.open();

    const afterOpen = awarenessFrames(ws);
    vi.advanceTimersByTime(15_000);
    expect(awarenessFrames(ws)).toBeGreaterThan(afterOpen);

    provider.destroy();
  });

  it("re-announces when a new remote peer appears (stateless relay)", () => {
    const provider = new CollabProvider("survey-1", { name: "Host", color: "#111" });
    const ws = MockWebSocket.instances[0];
    ws.open();

    const before = awarenessFrames(ws);
    ws.deliver(remotePeerFrame("Joiner"));

    // The joiner is now visible…
    expect(provider.presence().map((p) => p.name)).toContain("Joiner");
    // …and we re-announced ourselves so the joiner learns about us too.
    expect(awarenessFrames(ws)).toBeGreaterThan(before);

    provider.destroy();
  });

  it("reconnects when the page becomes visible after the socket dropped", () => {
    const provider = new CollabProvider("survey-1", { name: "Host", color: "#111" });
    MockWebSocket.instances[0].open();
    // Simulate a mobile background suspend that killed the socket.
    MockWebSocket.instances[0].close();

    const before = MockWebSocket.instances.length;
    document.dispatchEvent(new Event("visibilitychange"));
    // A fresh socket was opened instead of waiting on the frozen retry timer.
    expect(MockWebSocket.instances.length).toBe(before + 1);

    provider.destroy();
  });

  it("does not reconnect on visibility while the socket is open", () => {
    const provider = new CollabProvider("survey-1", { name: "Host", color: "#111" });
    MockWebSocket.instances[0].open();

    const before = MockWebSocket.instances.length;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(MockWebSocket.instances.length).toBe(before);

    provider.destroy();
  });

  it("stops the heartbeat on destroy", () => {
    vi.useFakeTimers();
    const provider = new CollabProvider("survey-1", { name: "Host", color: "#111" });
    const ws = MockWebSocket.instances[0];
    ws.open();
    provider.destroy();

    const frames = awarenessFrames(ws);
    vi.advanceTimersByTime(60_000);
    expect(awarenessFrames(ws)).toBe(frames);
  });
});

describe("CollabProvider document convergence", () => {
  it("brings a late joiner up to the latest document", () => {
    // Host connects and edits before anyone else joins.
    const host = new CollabProvider("s", { name: "Host", color: "#1" });
    const hostWs = MockWebSocket.instances[0];
    hostWs.open();
    applyContentToDoc(host.doc, content("Hello World"));

    // Joiner connects afterwards; the relay has no state to replay, so the
    // joiner relies on the on-join re-sync to converge.
    const joiner = new CollabProvider("s", { name: "Joiner", color: "#2" });
    const joinerWs = MockWebSocket.instances[1];
    joinerWs.open();
    pump(hostWs, joinerWs);

    expect(docToContent(joiner.doc).title).toBe("Hello World");

    host.destroy();
    joiner.destroy();
  });

  it("propagates an edit made after both are connected", () => {
    const host = new CollabProvider("s", { name: "Host", color: "#1" });
    const hostWs = MockWebSocket.instances[0];
    hostWs.open();
    const joiner = new CollabProvider("s", { name: "Joiner", color: "#2" });
    const joinerWs = MockWebSocket.instances[1];
    joinerWs.open();
    pump(hostWs, joinerWs);

    applyContentToDoc(host.doc, content("Live edit"));
    pump(hostWs, joinerWs);

    expect(docToContent(joiner.doc).title).toBe("Live edit");

    host.destroy();
    joiner.destroy();
  });
});
