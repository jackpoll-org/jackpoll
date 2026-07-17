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
