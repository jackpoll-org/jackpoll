import { describe, it, expect } from "vitest";
import type { Question } from "@/app/types/survey";
import { questionPalette, resolvePalette, toLongHex } from "../palette";

const question = (settings: Question["settings"]) => ({ id: "q1", settings }) as Question;

describe("resolvePalette", () => {
  it("prefers the question palette over the survey palette", () => {
    expect(resolvePalette(question({ colorPalette: ["#111111"] }), ["#222222"])).toEqual(["#111111"]);
  });

  it("falls back to the survey palette, then to the theme default", () => {
    expect(resolvePalette(question({ maxWords: 3 }), ["#222222"])).toEqual(["#222222"]);
    expect(resolvePalette(undefined, ["#222222"])).toEqual(["#222222"]);
    expect(resolvePalette(question(null), null)).toBeNull();
    expect(resolvePalette(question({}), [])).toBeNull();
  });

  it("ignores a malformed or empty question palette", () => {
    expect(questionPalette(question({ colorPalette: [] }))).toBeNull();
    expect(questionPalette(question({ colorPalette: "#111111" }))).toBeNull();
    expect(questionPalette(question({ colorPalette: [1, 2] }))).toBeNull();
    expect(resolvePalette(question({ colorPalette: [] }), ["#222222"])).toEqual(["#222222"]);
  });
});

describe("palette hardening", () => {
  it("ignores palettes containing anything but hex colours", () => {
    expect(questionPalette(question({ colorPalette: ["#111111", "url(https://example.com/x)"] }))).toBeNull();
    expect(resolvePalette(undefined, ["rebeccapurple"])).toBeNull();
    expect(resolvePalette(undefined, ["#abc", "#A1B2C3"])).toEqual(["#abc", "#A1B2C3"]);
  });

  it("expands short hex for colour inputs", () => {
    expect(toLongHex("#abc")).toBe("#aabbcc");
    expect(toLongHex("#a1b2c3")).toBe("#a1b2c3");
  });
});
