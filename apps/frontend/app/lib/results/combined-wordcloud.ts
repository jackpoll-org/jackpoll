import type { Question, QuestionResult } from "@/app/types/survey";
import { labelMap } from "@/app/lib/survey/export";
import { resolveResultChart } from "@/app/lib/survey/result-chart";
import { isAutoScored } from "@/app/lib/survey/grading";
import { choiceCountsToWords, colorWords, countsToWords, type CloudWord } from "./wordcloud";
import { questionPalette } from "./palette";

export type ColorMode = "light" | "dark";

export const COMBINED_WORD_CAP = 150;
export const MIN_CONTRAST = 4.5;

const AUTO_HUES = [217, 25, 145, 330, 265, 185, 0, 45, 100, 290];
const SATURATION = 70;
const BASE_LIGHTNESS: Record<ColorMode, number> = { light: 42, dark: 60 };
const SHADE_OFFSETS = [0, 10, 20];
const MIN_HUE_DISTANCE = 30;
const MIN_SATURATION = 0.15;
const BACKGROUND: Record<ColorMode, string> = { light: "#fbf9fa", dark: "#18181b" };

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(hex.trim());
  if (!m) return null;
  const digits = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)) as [number, number, number];
}

function hueOf(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0 || delta / (1 - Math.abs(max + min - 1)) < MIN_SATURATION) return null;
  const hue =
    max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return Math.round((hue * 60 + 360) % 360);
}

function hslToHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

function luminance(hex: string): number {
  const rgb = hexToRgb(hex) ?? [0, 0, 0];
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].toSorted((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function readableLightness(hue: number, mode: ColorMode): number {
  const step = mode === "light" ? -1 : 1;
  let l = BASE_LIGHTNESS[mode];
  while (contrastRatio(hslToHex(hue, SATURATION, l), BACKGROUND[mode]) < MIN_CONTRAST) l += step;
  return l;
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

export function wordcloudHues(palettes: (string[] | null | undefined)[]): (number | null)[] {
  const own = palettes.map((palette) => (palette?.length ? hueOf(palette[0]) : undefined));
  const taken = own.filter((hue): hue is number => hue != null);
  const distinct = (hue: number) => taken.every((used) => hueDistance(used, hue) >= MIN_HUE_DISTANCE);
  let autos = 0;
  return own.map((ownHue) => {
    if (ownHue !== undefined) return ownHue;
    const unused = AUTO_HUES.filter((hue) => !taken.includes(hue));
    const hue = unused.find(distinct) ?? unused[0] ?? AUTO_HUES[autos % AUTO_HUES.length];
    autos += 1;
    taken.push(hue);
    return hue;
  });
}

export function wordcloudFamily(hue: number, mode: ColorMode): string[] {
  const base = readableLightness(hue, mode);
  const direction = mode === "light" ? -1 : 1;
  return SHADE_OFFSETS.map((offset) => hslToHex(hue, SATURATION, base + direction * offset));
}

export interface CombinedWordcloud {
  words: CloudWord[];
  legend: { questionId: string; title: string; color: string }[];
}

export function inCombinedWordcloud(question: Question, isQuiz: boolean): boolean {
  if (question.type === "wordcloud") return true;
  return resolveResultChart(question) === "wordcloud" && !(isQuiz && isAutoScored(question));
}

function questionWords(question: Question, result: QuestionResult): CloudWord[] {
  if (question.type === "wordcloud") return countsToWords(result.optionCounts);
  const labels = labelMap(question);
  return choiceCountsToWords(
    Object.entries(result.optionCounts ?? {}).map(([id, count]) => ({ label: labels[id] ?? id, count })),
  );
}

export function combineWordclouds(
  questions: Question[],
  results: QuestionResult[],
  mode: ColorMode,
  cap = COMBINED_WORD_CAP,
): CombinedWordcloud {
  const resultById = new Map(results.map((r) => [r.questionId, r]));
  const clouds = questions.flatMap((question) => {
    const result = resultById.get(question.id);
    return inCombinedWordcloud(question, false) && result ? [{ question, result }] : [];
  });
  const palettes = clouds.map(({ question }) => questionPalette(question));
  const hues = wordcloudHues(palettes);
  const legend: CombinedWordcloud["legend"] = [];
  const words: CloudWord[] = [];
  clouds.forEach(({ question, result }, index) => {
    const colors = palettes[index] ?? wordcloudFamily(hues[index] ?? AUTO_HUES[0], mode);
    legend.push({ questionId: question.id, title: question.title, color: colors[0] });
    colorWords(questionWords(question, result), colors).forEach((word) => {
      words.push({ ...word, key: `${question.id}:${word.text}` });
    });
  });
  return { words: words.toSorted((a, b) => b.value - a.value).slice(0, cap), legend };
}

export function countWordcloudQuestions(questions: Question[]): number {
  return questions.filter((q) => inCombinedWordcloud(q, false)).length;
}
