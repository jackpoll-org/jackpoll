import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { firstErrorId, prefersReducedMotion, questionIds } from "@/app/lib/survey/a11y";
import { PREF_KEYS } from "@/app/lib/preferences/ui-prefs";

describe("prefersReducedMotion override (#settings)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defers to the media query when set to 'system' (default)", () => {
    expect(prefersReducedMotion()).toBe(false);
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    expect(prefersReducedMotion()).toBe(true);
  });

  it("forces reduced motion when the override is 'on'", () => {
    localStorage.setItem(PREF_KEYS.reducedMotion, "on");
    // media query says false, but the override wins
    expect(prefersReducedMotion()).toBe(true);
  });

  it("forces full motion when the override is 'off'", () => {
    localStorage.setItem(PREF_KEYS.reducedMotion, "off");
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe("a11y helpers", () => {
  it("finds the first errored question in display order", () => {
    const questions = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(
      firstErrorId(questions, { a: null, b: "Required", c: "Too long" }),
    ).toBe("b");
    expect(firstErrorId(questions, { a: null, b: null, c: null })).toBeNull();
    expect(firstErrorId([], {})).toBeNull();
  });

  it("derives stable, linked ids for a question", () => {
    expect(questionIds("q1")).toEqual({
      group: "survey-q-q1",
      title: "survey-q-q1-title",
      error: "survey-q-q1-error",
    });
  });
});
