import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";

const playTick = vi.fn();
const playReveal = vi.fn();
let reducedMotion = false;

vi.mock("@/app/lib/live/sound", () => ({
  playTick: () => playTick(),
  playReveal: () => playReveal(),
}));
vi.mock("@/app/lib/survey/a11y", () => ({
  prefersReducedMotion: () => reducedMotion,
}));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: "en" }),
}));

import { CountdownOverlay } from "../countdown-overlay";

beforeEach(() => {
  cleanup();
  reducedMotion = false;
  playTick.mockClear();
  playReveal.mockClear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("CountdownOverlay", () => {
  it("renders nothing when inactive", () => {
    const { container } = render(<CountdownOverlay active={false} questionKey={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("ticks 3 -> 2 -> 1 -> Go! and calls onComplete once", () => {
    const onComplete = vi.fn();
    render(<CountdownOverlay active questionKey={0} onComplete={onComplete} />);

    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("live.getReady")).toBeTruthy();

    act(() => vi.advanceTimersByTime(700));
    expect(screen.getByText("2")).toBeTruthy();
    expect(playTick).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(700));
    expect(screen.getByText("1")).toBeTruthy();
    expect(playTick).toHaveBeenCalledTimes(2);

    act(() => vi.advanceTimersByTime(700));
    expect(screen.getByText("live.go")).toBeTruthy();
    expect(screen.queryByText("live.getReady")).toBeNull();
    expect(playReveal).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(500));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("skips straight to Go! and completes immediately under reduced motion", () => {
    reducedMotion = true;
    const onComplete = vi.fn();
    render(<CountdownOverlay active questionKey={0} onComplete={onComplete} />);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(playTick).not.toHaveBeenCalled();
  });
});
