// ── Dashboard survey sorting (issues #94) ──────────────────────────
//
// Shared, React-free ordering used by the dashboard grid and the explorer list
// so both stay consistent. `manual` follows the user's drag order (persisted as
// `sortPosition`); the rest are recency/title sorts.

import type { Survey } from "@/app/types/survey";

export type SortBy = "updated" | "created" | "title" | "manual";

const POSITION_FALLBACK = Number.MAX_SAFE_INTEGER;

/** Return a new array of surveys ordered by the chosen sort. */
export function sortSurveys(surveys: readonly Survey[], sort: SortBy): Survey[] {
  return surveys.toSorted((a, b) => {
    if (sort === "manual") {
      const pa = a.sortPosition ?? POSITION_FALLBACK;
      const pb = b.sortPosition ?? POSITION_FALLBACK;
      if (pa !== pb) return pa - pb;
      // Tie-break (e.g. un-positioned surveys) by most-recently-updated.
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
    if (sort === "title") return a.title.localeCompare(b.title);
    const key: keyof Survey = sort === "created" ? "createdAt" : "updatedAt";
    return (
      new Date(b[key] as string).getTime() - new Date(a[key] as string).getTime()
    );
  });
}
