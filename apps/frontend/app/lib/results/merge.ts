import type { SurveyResults } from "@/app/types/survey";

/** A single wordcloud delta pushed over the live-results socket. */
export interface WordcloudDelta {
  questionId: string;
  words: string[];
}

/** The JSON message shape broadcast by the backend on each submission. */
export interface ResultsDeltaMessage {
  v: number;
  deltas: WordcloudDelta[];
}

/**
 * Parse a live-results socket message. Returns the delta message when it is a
 * recognized JSON payload, or null for the bare "updated" ping (caller should
 * refetch instead).
 */
export function parseResultsMessage(data: string): ResultsDeltaMessage | null {
  if (!data || data[0] !== "{") return null;
  try {
    const parsed = JSON.parse(data) as ResultsDeltaMessage;
    if (parsed?.v === 1 && Array.isArray(parsed.deltas)) return parsed;
  } catch {
    // Not JSON — treat as a plain ping.
  }
  return null;
}

/**
 * Merge wordcloud word deltas into a cached results payload without a refetch:
 * increments each word's count and the question's answered tally, and bumps the
 * survey-level response count once. Immutable — returns a new object. Periodic
 * polling still reconciles the exact counts, so small drift is self-correcting.
 */
export function mergeWordcloudDeltas(
  results: SurveyResults,
  deltas: WordcloudDelta[],
): SurveyResults {
  if (deltas.length === 0) return results;
  const byId = new Map(deltas.map((d) => [d.questionId, d]));

  const questions = results.questions.map((q) => {
    const delta = byId.get(q.questionId);
    if (!delta || delta.words.length === 0) return q;
    const optionCounts = { ...(q.optionCounts ?? {}) };
    for (const word of delta.words) {
      optionCounts[word] = (optionCounts[word] ?? 0) + 1;
    }
    return { ...q, optionCounts, answered: q.answered + 1 };
  });

  return {
    ...results,
    questions,
    totalResponses: results.totalResponses + 1,
    lastResponseAt: new Date().toISOString(),
  };
}
