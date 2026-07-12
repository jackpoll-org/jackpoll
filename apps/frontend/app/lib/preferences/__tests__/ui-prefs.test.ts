import { describe, expect, it, beforeEach } from "vitest";
import {
  PREF_KEYS,
  readHideBrand,
  readReducedMotionPref,
} from "@/app/lib/preferences/ui-prefs";

beforeEach(() => {
  localStorage.clear();
  document.cookie.split(";").forEach((c) => {
    document.cookie = `${c.split("=")[0].trim()}=; path=/; max-age=0`;
  });
});

describe("readReducedMotionPref", () => {
  it("defaults to 'system' when unset or invalid", () => {
    expect(readReducedMotionPref()).toBe("system");
    localStorage.setItem(PREF_KEYS.reducedMotion, "nonsense");
    expect(readReducedMotionPref()).toBe("system");
  });

  it("reads a valid override", () => {
    localStorage.setItem(PREF_KEYS.reducedMotion, "on");
    expect(readReducedMotionPref()).toBe("on");
    localStorage.setItem(PREF_KEYS.reducedMotion, "off");
    expect(readReducedMotionPref()).toBe("off");
  });
});

describe("readHideBrand", () => {
  it("is false unless the cookie is exactly '1'", () => {
    expect(readHideBrand()).toBe(false);
    document.cookie = `${PREF_KEYS.hideBrand}=0; path=/`;
    expect(readHideBrand()).toBe(false);
    document.cookie = `${PREF_KEYS.hideBrand}=1; path=/`;
    expect(readHideBrand()).toBe(true);
  });
});
