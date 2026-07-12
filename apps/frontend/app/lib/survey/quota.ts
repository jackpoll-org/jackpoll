// ── Per-option response quotas (issue #38) ─────────────────────────
//
// Capacity is owner-set on single-select choice options (multiple-choice /
// dropdown). `used` is maintained server-side. These helpers derive the
// remaining capacity and "full" state for the player and results views. The
// server remains the source of truth and re-checks every quota at submit time.

import type { Option, Question } from "@/app/types/survey";

/** Question types whose options can carry a quota. */
export function supportsQuota(question: Question): boolean {
  return question.type === "multiple-choice" || question.type === "dropdown";
}

/** Remaining slots for an option, or null when it has no quota. */
export function remainingFor(option: Option): number | null {
  if (option.capacity == null) return null;
  return Math.max(0, option.capacity - (option.used ?? 0));
}

/** Whether an option has a quota that is exhausted. */
export function isOptionFull(option: Option): boolean {
  const remaining = remainingFor(option);
  return remaining !== null && remaining <= 0;
}

/**
 * Ids of a question's options that are full and should be blocked in the
 * player. `keepSelectedId` (the respondent's current pick) is never blocked so
 * they are not locked out of a choice they already made.
 */
export function fullOptionIds(
  question: Question,
  keepSelectedId?: string,
): string[] {
  if (!supportsQuota(question)) return [];
  return (question.options ?? [])
    .filter((o) => o.id !== keepSelectedId && isOptionFull(o))
    .map((o) => o.id);
}
