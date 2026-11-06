import type { Question, SurveyResponseDto } from "@/app/types/survey";

const UNGROUPED_TYPES = new Set<Question["type"]>(["file-upload", "signature"]);

export interface AnswerGroup {
  key: string;
  value: unknown;
  responses: SurveyResponseDto[];
}

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
  if (isAutoScored(question)) return false;
  const optedIn = question.settings?.manualGrading === true;
  return optedIn && (question.type === "short-answer" || question.type === "file-upload");
}

export function isAutoScored(question: Question): boolean {
  return (question.correctAnswers?.length ?? 0) > 0;
}

export function isGradable(question: Question, liveMode: boolean): boolean {
  return isManuallyGraded(question) || (!liveMode && isAutoScored(question));
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

export function formatResultCode(code: string): string {
  if (code.length === 8) return `${code.slice(0, 4)}-${code.slice(4)}`;
  if (code.length === 6) return `${code.slice(0, 3)}-${code.slice(3)}`;
  return code;
}

export function answerKey(question: Question, value: unknown): string {
  if (typeof value === "string") return value.trim().replace(/\s+/g, " ");
  if (Array.isArray(value)) return JSON.stringify(value.map(String).toSorted());
  return JSON.stringify(value);
}

export function groupAnswers(question: Question, responses: SurveyResponseDto[]): AnswerGroup[] {
  const groups = new Map<string, AnswerGroup>();
  for (const response of responses) {
    const answer = response.answers.find((a) => a.questionId === question.id);
    const value = answer?.value;
    if (!hasAnswer(value)) continue;
    const key = UNGROUPED_TYPES.has(question.type)
      ? `response:${response.id}`
      : `${answerKey(question, value)}|${answer?.autoPoints ?? ""}`;
    const group = groups.get(key);
    if (group) group.responses.push(response);
    else groups.set(key, { key, value, responses: [response] });
  }
  return [...groups.values()].toSorted((a, b) => b.responses.length - a.responses.length);
}

export function sharedPoints(question: Question, responses: SurveyResponseDto[]): number | null | "mixed" {
  const points = responses.map(
    (r) => r.answers.find((a) => a.questionId === question.id)?.awardedPoints ?? null,
  );
  return points.every((p) => p === points[0]) ? points[0] : "mixed";
}
