// ── Score-based outcome pages (issue #83) ───────────────────────────
//
// After a quiz submit, the first outcome whose [minScore, maxScore] range
// contains the score is shown (e.g. a personality-quiz result). An unset bound
// is treated as open-ended.

import type { Outcome } from "@/app/types/survey";

/** The outcome matching a score, or null when none apply / no score. */
export function matchOutcome(
  outcomes: Outcome[] | undefined,
  score: number | null | undefined,
): Outcome | null {
  if (!outcomes || outcomes.length === 0 || score == null) return null;
  return (
    outcomes.find((o) => {
      const aboveMin = o.minScore == null || score >= o.minScore;
      const belowMax = o.maxScore == null || score <= o.maxScore;
      return aboveMin && belowMax;
    }) ?? null
  );
}
