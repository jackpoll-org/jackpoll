// ── Results aggregation helpers ─────────────────────────────────────

export interface GroupedAnswer {
  /** Display label (first occurrence's trimmed original casing). */
  label: string;
  /** How many responses gave this answer (case-insensitive). */
  count: number;
}

/**
 * Group free-text answers, treating differing case and surrounding whitespace
 * as the same answer (e.g. "Yes", "yes", " YES " count together). Blank answers
 * are dropped. Sorted by count desc, then alphabetically.
 */
export function groupTextAnswers(answers: string[]): GroupedAnswer[] {
  const map = new Map<string, GroupedAnswer>();
  for (const raw of answers) {
    const label = raw.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    const existing = map.get(key);
    if (existing) existing.count += 1;
    else map.set(key, { label, count: 1 });
  }
  return [...map.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );
}
