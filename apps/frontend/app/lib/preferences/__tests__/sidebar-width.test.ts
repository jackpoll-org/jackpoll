import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_KEY,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  clampSidebarWidth,
  readSidebarWidth,
  writeSidebarWidth,
} from "../sidebar-width";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("sidebar width", () => {
  it("clamps to the allowed range and falls back on garbage", () => {
    expect(clampSidebarWidth(10)).toBe(SIDEBAR_WIDTH_MIN);
    expect(clampSidebarWidth(5000)).toBe(SIDEBAR_WIDTH_MAX);
    expect(clampSidebarWidth(300.6)).toBe(301);
    expect(clampSidebarWidth(Number.NaN)).toBe(SIDEBAR_WIDTH_DEFAULT);
  });

  it("round-trips through localStorage and clamps stored values", () => {
    expect(readSidebarWidth()).toBe(SIDEBAR_WIDTH_DEFAULT);
    writeSidebarWidth(320);
    expect(localStorage.getItem(SIDEBAR_WIDTH_KEY)).toBe("320");
    expect(readSidebarWidth()).toBe(320);
    localStorage.setItem(SIDEBAR_WIDTH_KEY, "9999");
    expect(readSidebarWidth()).toBe(SIDEBAR_WIDTH_MAX);
    localStorage.setItem(SIDEBAR_WIDTH_KEY, "wide");
    expect(readSidebarWidth()).toBe(SIDEBAR_WIDTH_DEFAULT);
  });

  it("survives a storage that throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readSidebarWidth()).toBe(SIDEBAR_WIDTH_DEFAULT);
    expect(() => writeSidebarWidth(300)).not.toThrow();
  });
});
