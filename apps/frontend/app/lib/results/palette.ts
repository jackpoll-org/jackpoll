import type { Question } from "@/app/types/survey";

const HEX_COLOR = /^#(?:[0-9a-f]{3}){1,2}$/i;

function asPalette(value: unknown): string[] | null {
  return Array.isArray(value) && value.length > 0 && value.every((c) => typeof c === "string" && HEX_COLOR.test(c))
    ? value
    : null;
}

export function toLongHex(color: string): string {
  return /^#[0-9a-f]{3}$/i.test(color) ? `#${[...color.slice(1)].map((c) => c + c).join("")}` : color;
}

export function questionPalette(question?: Question | null): string[] | null {
  return asPalette(question?.settings?.colorPalette);
}

export function resolvePalette(
  question: Question | null | undefined,
  surveyPalette: string[] | null | undefined,
): string[] | null {
  return questionPalette(question) ?? asPalette(surveyPalette);
}
