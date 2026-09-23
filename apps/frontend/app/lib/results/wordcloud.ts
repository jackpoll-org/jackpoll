// Word-cloud data + sizing shared by the on-screen cloud (wordcloud-cloud-impl)
// and the PDF export, so both size and lay out words the same way.

export interface CloudWord {
  text: string;
  value: number;
}

/**
 * "absolute": size grows by a fixed step per vote (suits a wordcloud question,
 * where most words have a handful of votes). "relative": size follows each
 * word's share of the top word's votes (suits a choice question, where a few
 * options collect hundreds of votes and would all hit the cap otherwise).
 */
export type CloudScale = "absolute" | "relative";

// Roughly how many votes a word needs to reach the maximum font size on the
// absolute scale. A small number would make a 2nd vote look enormous next to a
// 1-vote word; a larger one keeps the gap gentle for a live poll's small counts.
const VOTES_TO_MAX = 10;

/** A wordcloud question's word -> count map, most frequent first. */
export function countsToWords(
  counts: Record<string, number> | null | undefined,
): CloudWord[] {
  return Object.entries(counts ?? {})
    .map(([text, value]) => ({ text, value }))
    .toSorted((a, b) => b.value - a.value);
}

/**
 * A choice question's per-option counts (already labelled) as cloud words:
 * options nobody picked are dropped (results list every option, even at 0) and
 * options sharing a label are merged so the same word isn't drawn twice.
 */
export function choiceCountsToWords(data: { label: string; count: number }[]): CloudWord[] {
  const merged = new Map<string, number>();
  for (const { label, count } of data) {
    const text = label.trim();
    if (!text || count <= 0) continue;
    merged.set(text, (merged.get(text) ?? 0) + count);
  }
  return [...merged]
    .map(([text, value]) => ({ text, value }))
    .toSorted((a, b) => b.value - a.value);
}

/** Font size for a word with {@code value} votes, the top word having {@code maxValue}. */
export function cloudFontSize(
  value: number,
  maxValue: number,
  opts: { minFontSize: number; maxFontSize: number; scale: CloudScale },
): number {
  const { minFontSize, maxFontSize, scale } = opts;
  if (scale === "relative") {
    const share = maxValue > 0 ? Math.max(0, value) / maxValue : 0;
    // Square root so a word with a quarter of the votes still reads at half size.
    return Math.round(minFontSize + (maxFontSize - minFontSize) * Math.sqrt(share));
  }
  // A single vote starts a bit above the floor, each extra vote adds a fixed
  // step, capped at the max — popularity reads clearly while a 2x word stays
  // only modestly larger than a 1x word.
  const base = Math.max(minFontSize, Math.round(maxFontSize * 0.3));
  const step = (maxFontSize - base) / VOTES_TO_MAX;
  return Math.min(maxFontSize, base + Math.max(0, value - 1) * step);
}
