import { describe, it, expect } from "vitest";
import { choiceCountsToWords, cloudFontRange, cloudFontSize, countsToWords } from "../wordcloud";

describe("countsToWords", () => {
  it("turns a word -> count map into words, most frequent first", () => {
    expect(countsToWords({ fast: 2, simple: 3 })).toEqual([
      { text: "simple", value: 3 },
      { text: "fast", value: 2 },
    ]);
  });

  it("handles missing counts", () => {
    expect(countsToWords(null)).toEqual([]);
  });
});

describe("choiceCountsToWords", () => {
  it("drops options nobody picked (results list every option, even at 0)", () => {
    expect(
      choiceCountsToWords([
        { label: "Simple", count: 3 },
        { label: "Modern", count: 0 },
      ]),
    ).toEqual([{ text: "Simple", value: 3 }]);
  });

  it("merges options that share a label so one word isn't drawn twice", () => {
    expect(
      choiceCountsToWords([
        { label: "Fast", count: 1 },
        { label: "Simple", count: 1 },
        { label: "Fast", count: 2 },
      ]),
    ).toEqual([
      { text: "Fast", value: 3 },
      { text: "Simple", value: 1 },
    ]);
  });

  it("skips blank labels", () => {
    expect(choiceCountsToWords([{ label: "  ", count: 4 }])).toEqual([]);
  });
});

describe("cloudFontSize", () => {
  const sizes = { minFontSize: 22, maxFontSize: 80 };

  it("absolute scale: grows gently per vote and caps at the max", () => {
    const one = cloudFontSize(1, 1, { ...sizes, scale: "absolute" });
    const two = cloudFontSize(2, 2, { ...sizes, scale: "absolute" });
    expect(two).toBeGreaterThan(one);
    expect(two - one).toBeLessThan(10);
    expect(cloudFontSize(500, 500, { ...sizes, scale: "absolute" })).toBe(80);
  });

  it("relative scale: the top option gets the max, others shrink with their share", () => {
    const top = cloudFontSize(500, 500, { ...sizes, scale: "relative" });
    const half = cloudFontSize(250, 500, { ...sizes, scale: "relative" });
    const few = cloudFontSize(5, 500, { ...sizes, scale: "relative" });
    expect(top).toBe(80);
    expect(half).toBeLessThan(top);
    expect(few).toBeLessThan(half);
    expect(few).toBeGreaterThanOrEqual(22);
  });

  it("relative scale: equal votes draw equal sizes", () => {
    expect(cloudFontSize(3, 3, { ...sizes, scale: "relative" })).toBe(80);
  });
});

describe("cloudFontRange", () => {
  it("scales with the smaller side of the box", () => {
    expect(cloudFontRange(700, 320)).toEqual({ minFontSize: 20, maxFontSize: 70 });
    expect(cloudFontRange(340, 320)).toEqual(cloudFontRange(700, 320));
    expect(cloudFontRange(375, 700).maxFontSize).toBe(83);
  });

  it("clamps tiny and huge boxes", () => {
    expect(cloudFontRange(100, 80)).toEqual({ minFontSize: 12, maxFontSize: 24 });
    expect(cloudFontRange(3000, 2000)).toEqual({ minFontSize: 45, maxFontSize: 160 });
  });
});
