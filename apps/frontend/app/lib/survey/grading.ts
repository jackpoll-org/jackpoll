import type { Question, SurveyResponseDto } from "@/app/types/survey";

const UNGROUPED_TYPES = new Set<Question["type"]>(["file-upload", "signature"]);

export interface AnswerGroup {
  key: string;
  value: unknown;
  responses: SurveyResponseDto[];
}

// Manual grading (public #6). Mirrors QuizScoring.isManuallyGraded / pointsFor
// on the backend, which is the source of truth for scores.

export const CHOICE_TYPES = new Set<Question["type"]>(["multiple-choice", "dropdown", "checkboxes"]);

type PointsMap = Record<string, number>;

export const POINTS_LIMIT = 1000;

function pointsMap(question: Question, key: "optionPoints" | "answerPoints", min: number): PointsMap | null {
  const raw = question.settings?.[key];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const entries = Object.entries(raw).flatMap(([id, v]) =>
    typeof v === "number" ? [[id, Math.max(min, Math.min(POINTS_LIMIT, Math.trunc(v)))] as const] : [],
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export function optionPoints(question: Question): PointsMap | null {
  if (!CHOICE_TYPES.has(question.type)) return null;
  const points = pointsMap(question, "optionPoints", -POINTS_LIMIT);
  if (!points) return null;
  const optionIds = new Set((question.options ?? []).map((o) => o.id));
  const current = Object.entries(points).filter(([id]) => optionIds.has(id));
  return current.length > 0 ? Object.fromEntries(current) : null;
}

export function ownPoints(points: PointsMap, key: string): number | undefined {
  return Object.hasOwn(points, key) ? points[key] : undefined;
}

export function answerPoints(question: Question): PointsMap | null {
  return question.type === "short-answer" ? pointsMap(question, "answerPoints", 0) : null;
}

export function scoresOrder(question: Question): boolean {
  return question.type === "ranking" && question.settings?.scoreOrder === true;
}

export function basePoints(question: Question): number {
  return question.points != null && question.points >= 0 ? question.points : 1;
}

/** Points a question is worth, derived from per-answer points when set. */
export function maxPointsFor(question: Question): number {
  const options = optionPoints(question);
  if (options) {
    const values = Object.values(options);
    const max =
      question.type === "checkboxes"
        ? values.filter((p) => p > 0).reduce((sum, p) => sum + p, 0)
        : Math.max(...values);
    return Math.max(0, max);
  }
  const base = basePoints(question);
  const answers = answerPoints(question);
  const accepted = (question.correctAnswers ?? []).filter((c) => c.trim() !== "");
  if (!answers || accepted.length === 0) return base;
  return Math.max(...accepted.map((c) => ownPoints(answers, c) ?? base));
}

/**
 * Option points matching today's answer key, as the start for editing them.
 * Multiple choice splits the question's points over the correct options and
 * takes the same share off for a wrong one, so ticking everything isn't free.
 */
export function seededOptionPoints(question: Question): PointsMap {
  const correct = new Set(question.correctAnswers ?? []);
  if (question.type !== "checkboxes") {
    const worth = basePoints(question);
    return Object.fromEntries((question.options ?? []).map((o) => [o.id, correct.has(o.id) ? worth : 0]));
  }
  const base = basePoints(question);
  const share = base === 0 ? 0 : Math.max(1, Math.round(base / Math.max(1, correct.size)));
  return Object.fromEntries((question.options ?? []).map((o) => [o.id, correct.has(o.id) ? share : -share]));
}

/** The options counted as correct for a set of option points: the best one(s), or every positive one. */
export function correctFromPoints(question: Question, points: PointsMap): string[] {
  const entries = Object.entries(points);
  if (question.type === "checkboxes") return entries.filter(([, p]) => p > 0).map(([id]) => id);
  const best = Math.max(0, ...entries.map(([, p]) => p));
  return best > 0 ? entries.filter(([, p]) => p === best).map(([id]) => id) : [];
}

export function withOptionPoints(question: Question, optionId: string, points: number): Partial<Question> {
  const current = optionPoints(question) ?? seededOptionPoints(question);
  const next = Object.fromEntries(
    (question.options ?? []).map((o) => [o.id, o.id === optionId ? points : (ownPoints(current, o.id) ?? 0)]),
  );
  return {
    settings: { ...(question.settings ?? {}), optionPoints: next },
    correctAnswers: correctFromPoints(question, next),
  };
}

export function withoutOptionPoints(question: Question): Record<string, unknown> {
  return Object.fromEntries(Object.entries(question.settings ?? {}).filter(([key]) => key !== "optionPoints"));
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
  return (
    (question.correctAnswers ?? []).some((c) => c.trim() !== "") ||
    Object.values(optionPoints(question) ?? {}).some((p) => p > 0) ||
    scoresOrder(question)
  );
}

export function isGradable(question: Question, liveMode: boolean): boolean {
  if (maxPointsFor(question) === 0) return false;
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
