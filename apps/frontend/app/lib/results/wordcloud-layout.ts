// Word-cloud layout without React, for the PDF export: d3-cloud (the same
// engine @visx/wordcloud uses on screen) positions the words, and the caller
// draws them. Browser-only — d3-cloud measures words on a canvas.

import cloud from "d3-cloud";
import { cloudFontSize, type CloudScale, type CloudWord } from "./wordcloud";

export interface PlacedWord {
  text: string;
  /** Font size in the caller's unit (pt for the PDF). */
  size: number;
  /** Word centre, relative to the centre of the cloud area. */
  x: number;
  y: number;
}

export interface CloudLayoutOptions {
  width: number;
  height: number;
  minFontSize: number;
  maxFontSize: number;
  scale: CloudScale;
  /** Font the words are measured in; must match the font they're drawn in. */
  font?: string;
  fontWeight?: string;
}

/**
 * Lay out {@code words} in a {@code width} x {@code height} area. Deterministic
 * (fixed "random"), no rotation — matching the on-screen cloud. Words that
 * don't fit (typically very long labels) come back in {@code dropped} so the
 * caller can still list them instead of losing them silently.
 */
export function layoutCloud(
  words: CloudWord[],
  opts: CloudLayoutOptions,
): Promise<{ placed: PlacedWord[]; dropped: CloudWord[] }> {
  if (words.length === 0) return Promise.resolve({ placed: [], dropped: [] });
  const maxValue = Math.max(...words.map((w) => w.value));
  const sized: cloud.Word[] = words.map((w) => ({
    text: w.text,
    size: cloudFontSize(w.value, maxValue, opts),
  }));

  return new Promise((resolve) => {
    cloud()
      .size([opts.width, opts.height])
      .words(sized)
      .padding(2)
      .rotate(0)
      .font(opts.font ?? "Helvetica, Arial, sans-serif")
      .fontWeight(opts.fontWeight ?? "bold")
      .fontSize((w) => w.size ?? opts.minFontSize)
      .random(() => 0.5)
      .spiral("archimedean")
      .on("end", (out) => {
        const placed = out.map((w) => ({
          text: w.text ?? "",
          size: w.size ?? 0,
          x: w.x ?? 0,
          y: w.y ?? 0,
        }));
        const shown = new Set(placed.map((w) => w.text));
        const dropped = words.filter((w) => !shown.has(w.text));
        resolve({ placed, dropped });
      })
      .start();
  });
}
