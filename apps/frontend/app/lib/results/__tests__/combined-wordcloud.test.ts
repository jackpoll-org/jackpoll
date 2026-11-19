import { describe, it, expect } from "vitest";
import {
  MIN_CONTRAST,
  combineWordclouds,
  contrastRatio,
  wordcloudFamily,
  wordcloudHues,
} from "../combined-wordcloud";
import type { Question, QuestionResult } from "@/app/types/survey";

function cloudQuestion(id: string, title: string, settings?: Record<string, unknown>): Question {
  return { id, type: "wordcloud", title, required: false, order: 0, settings } as Question;
}

function cloudResult(questionId: string, optionCounts: Record<string, number>): QuestionResult {
  return { questionId, type: "wordcloud", title: questionId, answered: 1, optionCounts };
}

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

const CARD_BACKGROUNDS = {
  light: ["#ffffff", "#fafafb", "#fbf9fa", "#f8fafc"],
  dark: ["#09090b", "#18181b", "#1d1512", "#13171e"],
};

describe("wordcloudFamily", () => {
  it.each(["light", "dark"] as const)("gives every hue readable shades on all %s card backgrounds", (mode) => {
    for (let h = 0; h < 360; h += 15) {
      const family = wordcloudFamily(h, mode);
      expect(family).toHaveLength(3);
      expect(new Set(family).size).toBe(3);
      for (const color of family) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/);
        for (const background of CARD_BACKGROUNDS[mode]) {
          expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(MIN_CONTRAST);
        }
      }
    }
  });
});

describe("wordcloudHues", () => {
  it("gives the first questions distinct automatic hues", () => {
    const hues = wordcloudHues(Array.from({ length: 10 }, () => null));
    expect(new Set(hues).size).toBe(10);
    hues.slice(0, 6).forEach((a, i) => hues.slice(i + 1, 6).forEach((b) => expect(hueGap(a, b)).toBeGreaterThanOrEqual(30)));
  });

  it("derives the hue from the first palette colour", () => {
    const [h] = wordcloudHues([["#ff0000", "#00ff00"]]);
    expect(h).toBe(0);
    for (const mode of ["light", "dark"] as const) {
      for (const color of wordcloudFamily(h, mode)) {
        const [r, g, b] = rgb(color);
        expect(r).toBeGreaterThan(g);
        expect(r).toBeGreaterThan(b);
      }
    }
  });

  it("moves a custom hue that clashes with an earlier question to an unused automatic hue", () => {
    const hues = wordcloudHues([["#ff0000"], ["#ff2a00"], ["#3b82f6"], null, ["#3b80f0"]]);
    expect(hues[0]).toBe(0);
    for (let i = 0; i < hues.length; i++) {
      for (let j = i + 1; j < hues.length; j++) expect(hueGap(hues[i], hues[j])).toBeGreaterThanOrEqual(30);
    }
  });

  it("keeps an automatic hue clear of an earlier custom one", () => {
    const [custom, auto] = wordcloudHues([["#2563eb"], null]);
    expect(hueGap(custom, auto)).toBeGreaterThanOrEqual(30);
  });

  it("falls back to an automatic hue for unusable or grey palette colours", () => {
    const auto = wordcloudHues([null, null]);
    expect(wordcloudHues([["var(--chart-1)"], ["#888888"]])).toEqual(auto);
    expect(wordcloudHues([[], ["#8a8888"]])).toEqual(auto);
  });

  it("still assigns a hue to every question beyond the automatic set", () => {
    const hues = wordcloudHues(Array.from({ length: 12 }, () => null));
    expect(hues).toHaveLength(12);
    expect(hues.every((h) => Number.isFinite(h))).toBe(true);
  });
});

describe("combineWordclouds", () => {
  const questions = [
    cloudQuestion("q1", "Hopes"),
    { id: "mc", type: "multiple-choice", title: "Pick", required: false, order: 1 } as Question,
    cloudQuestion("q2", "Fears", { colorPalette: ["#00aa00"] }),
  ];

  it("keeps the same word from two questions as separate, differently coloured entries", () => {
    const { words, legend } = combineWordclouds(
      questions,
      [cloudResult("q1", { fun: 3 }), cloudResult("q2", { fun: 2, rain: 1 })],
      "light",
    );

    expect(words.map((w) => [w.text, w.value, w.key])).toEqual([
      ["fun", 3, "q1:fun"],
      ["fun", 2, "q2:fun"],
      ["rain", 1, "q2:rain"],
    ]);
    const [auto, green] = wordcloudHues([null, ["#00aa00"]]);
    expect(green).toBe(120);
    expect(words[0].color).toBe(wordcloudFamily(auto, "light")[0]);
    expect(words[1].color).toBe(wordcloudFamily(green, "light")[0]);
    expect(words[2].color).toBe(wordcloudFamily(green, "light")[1]);
    expect(legend).toEqual([
      { questionId: "q1", title: "Hopes", color: wordcloudFamily(auto, "light")[0] },
      { questionId: "q2", title: "Fears", color: wordcloudFamily(green, "light")[0] },
    ]);
  });

  it("ignores a question palette that the palette rules reject", () => {
    const rejected = [cloudQuestion("q1", "Hopes"), cloudQuestion("q2", "Fears", { colorPalette: ["#00aa00ff", "#00aa00"] })];
    const { legend } = combineWordclouds(rejected, [cloudResult("q1", { a: 1 }), cloudResult("q2", { b: 1 })], "light");
    const [first, second] = wordcloudHues([null, null]);
    expect(legend.map((l) => l.color)).toEqual([
      wordcloudFamily(first, "light")[0],
      wordcloudFamily(second, "light")[0],
    ]);
  });

  it("caps the merged words to the most frequent ones", () => {
    const many = Object.fromEntries(Array.from({ length: 120 }, (_, i) => [`w${i}`, i + 1]));
    const { words } = combineWordclouds(
      questions,
      [cloudResult("q1", many), cloudResult("q2", many)],
      "dark",
      150,
    );

    expect(words).toHaveLength(150);
    expect(words[0].value).toBe(120);
    expect(Math.min(...words.map((w) => w.value))).toBe(46);
    expect(new Set(words.map((w) => w.key)).size).toBe(150);
  });

  it("leaves out questions without results and other question types", () => {
    const { words, legend } = combineWordclouds(questions, [cloudResult("q2", { sun: 1 })], "light");
    expect(words.map((w) => w.key)).toEqual(["q2:sun"]);
    expect(legend.map((l) => l.questionId)).toEqual(["q2"]);
  });
});
