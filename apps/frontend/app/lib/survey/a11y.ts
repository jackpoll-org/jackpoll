// ── Survey player accessibility helpers (issue #45) ────────────────

import { readReducedMotionPref } from "@/app/lib/preferences/ui-prefs";

/**
 * Whether motion should be minimised. The user's in-app override wins: "on"
 * forces reduced, "off" forces full motion; "system" (default) defers to the OS
 * `prefers-reduced-motion` media query.
 */
export function prefersReducedMotion(): boolean {
  const override = readReducedMotionPref();
  if (override === "on") return true;
  if (override === "off") return false;
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Scroll to the top of the page, honouring the reduced-motion preference. */
export function scrollToTop(): void {
  if (typeof window === "undefined") return;
  window.scrollTo({
    top: 0,
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}

/** First question id (in display order) that currently has a validation error. */
export function firstErrorId(
  questions: { id: string }[],
  errors: Record<string, string | null>,
): string | null {
  for (const q of questions) {
    if (errors[q.id]) return q.id;
  }
  return null;
}

/** Stable DOM ids tying a question's group, label and error message together. */
export function questionIds(questionId: string) {
  return {
    group: `survey-q-${questionId}`,
    title: `survey-q-${questionId}-title`,
    error: `survey-q-${questionId}-error`,
  };
}
