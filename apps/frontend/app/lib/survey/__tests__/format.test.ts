import { describe, expect, it, vi, afterEach } from "vitest";
import {
  clampPercent,
  formatDuration,
  formatRelative,
  formatAbsolute,
} from "../format";

describe("clampPercent", () => {
  it("returns 0 for a zero or negative denominator", () => {
    expect(clampPercent(5, 0)).toBe(0);
    expect(clampPercent(5, -1)).toBe(0);
  });

  it("rounds a normal ratio", () => {
    expect(clampPercent(1, 3)).toBe(33);
    expect(clampPercent(2, 4)).toBe(50);
  });

  it("never exceeds 100% even when submits > starts", () => {
    // e.g. a submit without a recorded start/view (dropped beacon)
    expect(clampPercent(7, 5)).toBe(100);
  });
});

describe("formatDuration", () => {
  it("returns em dash for null/negative", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(undefined)).toBe("—");
    expect(formatDuration(-5)).toBe("—");
  });

  it("formats sub-minute in seconds", () => {
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(999)).toBe("1s");
  });

  it("formats minutes with zero-padded seconds", () => {
    expect(formatDuration(125_000)).toBe("2m 05s");
    expect(formatDuration(600_000)).toBe("10m 00s");
  });
});

describe("formatRelative", () => {
  afterEach(() => vi.useRealTimers());

  it("returns em dash for missing/invalid input", () => {
    expect(formatRelative(null, "en")).toBe("—");
    expect(formatRelative("not-a-date", "en")).toBe("—");
  });

  it("reports hours ago in English", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));
    expect(formatRelative("2026-07-15T10:00:00Z", "en")).toBe("2 hours ago");
  });

  it("localizes to German", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));
    expect(formatRelative("2026-07-14T12:00:00Z", "de")).toBe("gestern");
  });
});

describe("formatAbsolute", () => {
  it("returns em dash for missing input", () => {
    expect(formatAbsolute(null, "en")).toBe("—");
  });

  it("produces a non-empty localized string for a valid date", () => {
    expect(formatAbsolute("2026-07-15T10:00:00Z", "en")).not.toBe("—");
  });
});
