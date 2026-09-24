import type { Question, SurveyResponseDto } from "@/app/types/survey";

// Manual grading (public #6). Mirrors QuizScoring.isManuallyGraded / pointsFor
// on the backend, which is the source of truth for scores.

/** Points a question is worth; unset or non-positive counts as 1. */
export function maxPointsFor(question: Question): number {
  return question.points != null && question.points > 0 ? question.points : 1;
}

/**
 * Answers a teacher grades by hand: paragraphs always, and short-answer /
 * file-upload questions without an answer key when "grade manually" is on.
 */
export function isManuallyGraded(question: Question): boolean {
  if (question.type === "long-answer") return true;
  if ((question.correctAnswers?.length ?? 0) > 0) return false;
  const optedIn = question.settings?.manualGrading === true;
  return optedIn && (question.type === "short-answer" || question.type === "file-upload");
}

/** Whether an answer value counts as "given" (blank text / empty list = not answered). */
export function hasAnswer(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Index of the next response still awaiting grades after {@code from}, wrapping around. */
export function nextPendingIndex(responses: SurveyResponseDto[], from: number): number {
  for (let step = 1; step <= responses.length; step++) {
    const i = (from + step) % responses.length;
    if (responses[i]?.gradingPending) return i;
  }
  return -1;
}
