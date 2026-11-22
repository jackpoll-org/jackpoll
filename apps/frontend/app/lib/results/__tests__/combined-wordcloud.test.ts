import { describe, it, expect } from "vitest";
import {
  MIN_CONTRAST,
  combineWordclouds,
  contrastRatio,
  countWordcloudQuestions,
  inCombinedWordcloud,
  wordcloudFamily,
  wordcloudHues,
} from "../combined-wordcloud";
import { colorWords, countsToWords } from "../wordcloud";
import type { Question, QuestionResult } from "@/app/types/survey";

function cloudQuestion(id: string, title: string, settings?: Record<string, unknown>): Question {
  return { id, type: "wordcloud", title, required: false, order: 0, settings } as Question;
}

function cloudResult(questionId: string, optionCounts: Record<string, number>): QuestionResult {
  return { questionId, type: "wordcloud", title: questionId, answered: 1, optionCounts };
}

const numericHues = (palettes: Parameters<typeof wordcloudHues>[0]) => wordcloudHues(palettes) as number[];

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
    const hues = numericHues(Array.from({ length: 10 }, () => null));
    expect(new Set(hues).size).toBe(10);
    hues.slice(0, 6).forEach((a, i) => hues.slice(i + 1, 6).forEach((b) => expect(hueGap(a, b)).toBeGreaterThanOrEqual(30)));
  });

  it("derives the hue from the first palette colour", () => {
    const [h] = numericHues([["#ff0000", "#00ff00"]]);
    expect(h).toBe(0);
    for (const mode of ["light", "dark"] as const) {
      for (const color of wordcloudFamily(h, mode)) {
        const [r, g, b] = rgb(color);
        expect(r).toBeGreaterThan(g);
        expect(r).toBeGreaterThan(b);
      }
    }
  });

  it("keeps every own-palette hue and keeps automatic hues clear of all of them", () => {
    const hues = wordcloudHues([["#ff0000"], ["#ff2a00"], ["#3b82f6"], null, ["#3b80f0"], null]);
    expect(hues.slice(0, 3)).toEqual([0, 10, 217]);
    const own = [hues[0], hues[1], hues[2], hues[4]] as number[];
    const autos = [hues[3], hues[5]] as number[];
    for (const auto of autos) own.forEach((h) => expect(hueGap(auto, h)).toBeGreaterThanOrEqual(30));
    expect(hueGap(autos[0], autos[1])).toBeGreaterThanOrEqual(30);
  });

  it.each([
    [[["#2563eb"], null]],
    [[null, ["#2563eb"]]],
  ])("keeps an automatic hue clear of a custom one in either order (%#)", (palettes) => {
    const hues = wordcloudHues(palettes);
    expect(hues).toContain(221);
    expect(hueGap(hues[0] as number, hues[1] as number)).toBeGreaterThanOrEqual(30);
  });

  it("spends no automatic hue on a question with its own palette", () => {
    expect(wordcloudHues([["#00ff00"], null, null]).slice(1)).toEqual(wordcloudHues([null, null]));
    expect(wordcloudHues([["#888888"], null])).toEqual([null, wordcloudHues([null])[0]]);
  });

  it("falls back to an automatic hue for an empty palette", () => {
    expect(wordcloudHues([[], null])).toEqual(wordcloudHues([null, null]));
  });

  it("still assigns a hue to every question beyond the automatic set", () => {
    const hues = numericHues(Array.from({ length: 12 }, () => null));
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
    const [auto] = numericHues([null, ["#00aa00"]]);
    expect(words[0].color).toBe(wordcloudFamily(auto, "light")[0]);
    expect(words[1].color).toBe("#00aa00");
    expect(words[2].color).toBe("#00aa00");
    expect(legend).toEqual([
      { questionId: "q1", title: "Hopes", color: wordcloudFamily(auto, "light")[0] },
      { questionId: "q2", title: "Fears", color: "#00aa00" },
    ]);
  });

  it("ignores a question palette that the palette rules reject", () => {
    const rejected = [cloudQuestion("q1", "Hopes"), cloudQuestion("q2", "Fears", { colorPalette: ["#00aa00ff", "#00aa00"] })];
    const { legend } = combineWordclouds(rejected, [cloudResult("q1", { a: 1 }), cloudResult("q2", { b: 1 })], "light");
    const [first, second] = numericHues([null, null]);
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

  it("gives a question with its own palette exactly the colours of its individual cloud", () => {
    const palette = ["#111111", "#ee2222", "#22ee22"];
    const counts = { b: 1, a: 3, c: 2, d: 1, e: 5 };
    const { words, legend } = combineWordclouds(
      [cloudQuestion("q1", "Own", { colorPalette: palette })],
      [cloudResult("q1", counts)],
      "dark",
    );
    const individual = colorWords(countsToWords(counts), palette);

    expect(words.map((w) => [w.text, w.color])).toEqual(individual.map((w) => [w.text, w.color]));
    expect(words.map((w) => w.color)).toEqual(["#111111", "#ee2222", "#22ee22", "#111111", "#ee2222"]);
    expect(legend[0].color).toBe("#111111");
  });

  it("keeps an earlier automatic family clear of a later question's own palette", () => {
    const { legend } = combineWordclouds(
      [cloudQuestion("q1", "Auto"), cloudQuestion("q2", "Own", { colorPalette: ["#2563eb"] })],
      [cloudResult("q1", { a: 1 }), cloudResult("q2", { b: 1 })],
      "light",
    );
    expect(legend[1].color).toBe("#2563eb");
    expect(legend[0].color).not.toBe(wordcloudFamily(217, "light")[0]);
    const [auto] = numericHues([null, ["#2563eb"]]);
    expect(hueGap(auto, 221)).toBeGreaterThanOrEqual(30);
    expect(legend[0].color).toBe(wordcloudFamily(auto, "light")[0]);
  });

  it("keeps automatic families clear of a custom palette's hue and ignores the survey palette", () => {
    const { legend } = combineWordclouds(
      [cloudQuestion("q1", "Own", { colorPalette: ["#2563eb"] }), cloudQuestion("q2", "Auto")],
      [cloudResult("q1", { a: 1 }), cloudResult("q2", { b: 1 })],
      "light",
    );
    const [, auto] = numericHues([["#2563eb"], null]);
    expect(legend.map((l) => l.color)).toEqual(["#2563eb", wordcloudFamily(auto, "light")[0]]);
  });

  const choice = (settings?: Record<string, unknown>): Question =>
    ({
      id: "ch",
      type: "checkboxes",
      title: "Fruit",
      required: false,
      order: 2,
      settings: { resultChart: "wordcloud", ...settings },
      options: [
        { id: "o1", label: "Apple" },
        { id: "o2", label: "Pear" },
        { id: "o3", label: "Apple" },
        { id: "o4", label: "Plum" },
      ],
    }) as Question;
  const choiceResult: QuestionResult = {
    questionId: "ch",
    type: "checkboxes",
    title: "Fruit",
    answered: 4,
    optionCounts: { o1: 1, o2: 3, o3: 2, o4: 0 },
  };

  it("includes a choice question shown as a word cloud, one word per picked option label", () => {
    const { words, legend } = combineWordclouds([choice()], [choiceResult], "light");
    const [hue] = numericHues([null]);
    const family = wordcloudFamily(hue, "light");

    expect(words.map((w) => [w.text, w.value, w.key, w.color])).toEqual([
      ["Apple", 3, "ch:Apple", family[0]],
      ["Pear", 3, "ch:Pear", family[1]],
    ]);
    expect(legend).toEqual([{ questionId: "ch", title: "Fruit", color: family[0] }]);
  });

  it("colours a choice question with its own palette like its individual word-cloud chart", () => {
    const { words } = combineWordclouds([choice({ colorPalette: ["#aa0000", "#0000aa"] })], [choiceResult], "light");
    expect(words.map((w) => [w.text, w.color])).toEqual([
      ["Apple", "#aa0000"],
      ["Pear", "#0000aa"],
    ]);
  });

  it.each([
    ["wordcloud", {}, false, true],
    ["multiple-choice", { resultChart: "wordcloud" }, false, true],
    ["dropdown", { resultChart: "wordcloud" }, false, true],
    ["checkboxes", { resultChart: "wordcloud" }, false, true],
    ["checkboxes", { resultChart: "pie" }, false, false],
    ["ranking", { resultChart: "wordcloud" }, false, false],
    ["multiple-choice", { resultChart: "wordcloud" }, true, false],
    ["multiple-choice", { resultChart: "wordcloud", poll: true }, true, true],
    ["multiple-choice", { resultChart: "wordcloud", optionPoints: { o1: 2 } }, true, false],
    ["wordcloud", {}, true, true],
  ] as const)("membership of a %s question with %j (quiz %s) is %s", (type, settings, isQuiz, expected) => {
    const question = {
      id: "x", type, title: "X", required: false, order: 0, settings,
      options: [{ id: "o1", label: "A" }], correctAnswers: type === "wordcloud" || "optionPoints" in settings ? [] : ["o1"],
    } as unknown as Question;
    expect(inCombinedWordcloud(question, isQuiz)).toBe(expected);
  });

  it("leaves out choice questions with another chart", () => {
    const pie = choice({ resultChart: "pie" });
    expect(combineWordclouds([pie], [choiceResult], "light").words).toEqual([]);
    expect(countWordcloudQuestions([pie, choice(), cloudQuestion("q1", "Hopes")])).toBe(2);
  });
});
