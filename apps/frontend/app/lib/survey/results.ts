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

export type DateAnswerMode = "date" | "time" | "datetime";

export interface TimeCount {
  /** "HH:MM" */
  time: string;
  count: number;
}

export interface DateGroup {
  /** "YYYY-MM-DD", empty for time-only mode. */
  date: string;
  /** Total responses in this group. */
  count: number;
  /** Grouped, chronologically sorted time-of-day picks within this date. */
  times: TimeCount[];
}

function countBy(values: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return map;
}

/**
 * Group date/time answers so the results view can show a date once with a
 * count instead of repeating it per response (e.g. "×6  11.12.1990" with the
 * chosen times listed underneath), rather than a flat per-response list.
 */
export function groupDateAnswers(answers: string[], mode: DateAnswerMode): DateGroup[] {
  if (mode === "date") {
    const counts = countBy(answers);
    return [...counts.entries()]
      .map(([date, count]) => ({ date, count, times: [] }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  if (mode === "time") {
    const counts = countBy(answers);
    const times = [...counts.entries()]
      .map(([time, count]) => ({ time, count }))
      .sort((a, b) => a.time.localeCompare(b.time));
    const count = times.reduce((sum, t) => sum + t.count, 0);
    return times.length > 0 ? [{ date: "", count, times }] : [];
  }

  // datetime: "YYYY-MM-DDTHH:MM"
  const byDate = new Map<string, string[]>();
  for (const raw of answers) {
    const [date, time = ""] = raw.split("T");
    if (!date) continue;
    const list = byDate.get(date) ?? [];
    list.push(time);
    byDate.set(date, list);
  }
  return [...byDate.entries()]
    .map(([date, times]) => {
      const counts = countBy(times);
      return {
        date,
        count: times.length,
        times: [...counts.entries()]
          .map(([time, count]) => ({ time, count }))
          .sort((a, b) => a.time.localeCompare(b.time)),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
