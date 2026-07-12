import { describe, it, expect } from "vitest";
import {
  mergeWordcloudDeltas,
  parseResultsMessage,
} from "../merge";
import type { SurveyResults } from "@/app/types/survey";

function baseResults(): SurveyResults {
  return {
    surveyId: "s1",
    title: "T",
    totalResponses: 2,
    lastResponseAt: "2026-06-30T00:00:00.000Z",
    questions: [
      {
        questionId: "q1",
        type: "wordcloud",
        title: "Cloud",
        answered: 2,
        optionCounts: { sunny: 2, warm: 1 },
      },
    ],
  };
}

describe("parseResultsMessage", () => {
  it("returns null for the bare ping", () => {
    expect(parseResultsMessage("updated")).toBeNull();
    expect(parseResultsMessage("")).toBeNull();
  });

  it("parses a v1 delta message", () => {
    const msg = parseResultsMessage(
      '{"v":1,"deltas":[{"questionId":"q1","words":["sunny"]}]}',
    );
    expect(msg).not.toBeNull();
    expect(msg!.deltas[0].questionId).toBe("q1");
  });

  it("returns null for unknown JSON shapes", () => {
    expect(parseResultsMessage('{"v":2,"deltas":[]}')).toBeNull();
    expect(parseResultsMessage('{"foo":1}')).toBeNull();
  });
});

describe("mergeWordcloudDeltas", () => {
  it("increments word counts, answered, and total responses immutably", () => {
    const before = baseResults();
    const after = mergeWordcloudDeltas(before, [
      { questionId: "q1", words: ["sunny", "cold"] },
    ]);

    // Original untouched.
    expect(before.questions[0].optionCounts).toEqual({ sunny: 2, warm: 1 });
    expect(before.totalResponses).toBe(2);

    expect(after.questions[0].optionCounts).toEqual({ sunny: 3, warm: 1, cold: 1 });
    expect(after.questions[0].answered).toBe(3);
    expect(after.totalResponses).toBe(3);
    expect(after.lastResponseAt).not.toBe(before.lastResponseAt);
  });

  it("leaves questions without a delta unchanged and bumps total once", () => {
    const after = mergeWordcloudDeltas(baseResults(), [
      { questionId: "missing", words: ["x"] },
    ]);
    expect(after.questions[0].answered).toBe(2);
    expect(after.totalResponses).toBe(3);
  });

  it("returns the same object for an empty delta list", () => {
    const before = baseResults();
    expect(mergeWordcloudDeltas(before, [])).toBe(before);
  });
});
