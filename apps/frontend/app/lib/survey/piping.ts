import type { Question } from "@/app/types/survey";
import { formatAnswer } from "@/app/lib/survey/export";
import type { AnswerValue } from "@/app/lib/survey/validation";

/** Matches piping tokens like {{questionId}} (ids are uuid / slug-ish). */
const TOKEN = /\{\{\s*([\w-]+)\s*\}\}/g;

/**
 * Replace {{questionId}} tokens in text with the readable value of that
 * question's current answer (issue #29). Unknown or empty references resolve
 * to the fallback. Output is plain text — React escapes it, so it is XSS-safe.
 */
export function resolvePiping(
  text: string | undefined,
  answers: Record<string, AnswerValue>,
  questions: Question[],
  fallback = "",
): string {
  if (!text) return text ?? "";
  const byId = new Map(questions.map((q) => [q.id, q]));
  return text.replace(TOKEN, (_match, id: string) => {
    const question = byId.get(id);
    const value = answers[id];
    if (!question || value == null || value === "") return fallback;
    return formatAnswer(question, value) || fallback;
  });
}

/** True when the text contains at least one piping token. */
export function hasPiping(text: string | undefined): boolean {
  return !!text && TOKEN.test(text);
}
