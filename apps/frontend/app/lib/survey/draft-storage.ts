// ── Local draft autosave (issue #26) ───────────────────────────────
//
// Instant, offline-friendly autosave of in-progress answers to localStorage.
// Complements the server-side draft store used for cross-device resume.

import type { AnswerInput } from "@/app/types/survey";

const PREFIX = "survey-draft:";

interface StoredDraft {
  answers: Record<string, unknown>;
  position?: number;
  savedAt: number;
}

function key(surveyId: string): string {
  return `${PREFIX}${surveyId}`;
}

/** Persist the current answers for a survey. No-op outside the browser. */
export function saveLocalDraft(
  surveyId: string,
  answers: Record<string, unknown>,
  position?: number,
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredDraft = { answers, position, savedAt: Date.now() };
    window.localStorage.setItem(key(surveyId), JSON.stringify(payload));
  } catch {
    // Storage may be full or disabled (private mode); autosave is best-effort.
  }
}

/** Read a previously saved local draft, or null when none/invalid. */
export function loadLocalDraft(surveyId: string): StoredDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(surveyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    if (!parsed || typeof parsed.answers !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Remove a local draft (e.g. after a successful submission). */
export function clearLocalDraft(surveyId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(surveyId));
  } catch {
    // ignore
  }
}

/** Convert the player's answer map into the API's answer-input list. */
export function answersToInputs(
  answers: Record<string, unknown>,
): AnswerInput[] {
  return Object.entries(answers).map(([questionId, value]) => ({
    questionId,
    value,
  }));
}
