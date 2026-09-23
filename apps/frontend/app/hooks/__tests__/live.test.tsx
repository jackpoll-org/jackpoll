import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

const getLiveStateApi = vi.fn();
vi.mock("@/app/lib/survey/api", () => ({
  getLiveStateApi: (...args: unknown[]) => getLiveStateApi(...args),
  liveJoinApi: vi.fn(),
  setLiveStateApi: vi.fn(),
}));

let capturedOnMessage: ((data: string) => void) | null = null;
vi.mock("@/app/lib/results/live-socket", () => ({
  liveResultsEnabled: () => true,
  ResultsLiveSocket: class {
    constructor(_surveyId: string, onMessage: (data: string) => void) {
      capturedOnMessage = onMessage;
    }
    destroy() {}
  },
}));

import { useLivePresence } from "../live";

beforeEach(() => {
  capturedOnMessage = null;
  getLiveStateApi.mockReset();
  getLiveStateApi.mockResolvedValue({ success: true, data: null });
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("useLivePresence", () => {
  it("applies state pushed over the socket", () => {
    const onState = vi.fn();
    renderHook(() => useLivePresence("survey-1", true, onState));

    capturedOnMessage!('{"live":{"index":1,"phase":"question"}}');

    expect(onState).toHaveBeenCalledWith({ index: 1, phase: "question" });
  });

  it("resync poll ignores a state matching what was already applied", async () => {
    const onState = vi.fn();
    getLiveStateApi.mockResolvedValue({
      success: true,
      data: { index: 1, phase: "question" },
    });
    renderHook(() => useLivePresence("survey-1", true, onState));

    capturedOnMessage!('{"live":{"index":1,"phase":"question"}}');
    expect(onState).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(6_000);

    expect(onState).toHaveBeenCalledTimes(1);
  });

  it("resync poll self-heals when it finds a state the socket never delivered", async () => {
    const onState = vi.fn();
    getLiveStateApi.mockResolvedValue({
      success: true,
      data: { index: 2, phase: "reveal" },
    });
    renderHook(() => useLivePresence("survey-1", true, onState));

    await vi.advanceTimersByTimeAsync(6_000);

    expect(onState).toHaveBeenCalledWith({ index: 2, phase: "reveal" });
  });

  it("does nothing when disabled", async () => {
    const onState = vi.fn();
    renderHook(() => useLivePresence("survey-1", false, onState));
    expect(capturedOnMessage).toBeNull();
    await vi.advanceTimersByTimeAsync(6_000);
    expect(getLiveStateApi).not.toHaveBeenCalled();
  });
});

describe("useCountdown", () => {
  // Between questions the ticking stops, so the first render of a new
  // question used an old "now": the timer briefly showed more time than the
  // question allows (23 for a 20 s question), then jumped back.
  it("never shows more than the question's seconds when a new timer starts", async () => {
    const { useCountdown } = await import("../live");
    const rendered: (number | null)[] = [];
    const { rerender } = renderHook(
      ({ startedAt }) => {
        const remaining = useCountdown(startedAt, 20);
        rendered.push(remaining);
        return remaining;
      },
      { initialProps: { startedAt: Date.now() as number | null } },
    );
    rerender({ startedAt: null });
    await vi.advanceTimersByTimeAsync(3_000);
    rendered.length = 0;
    rerender({ startedAt: Date.now() });
    expect(Math.max(...rendered.filter((r): r is number => r != null))).toBe(20);
  });
});
