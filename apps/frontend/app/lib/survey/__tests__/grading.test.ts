import { describe, it, expect } from "vitest";
import {
  answerKey,
  formatResultCode,
  groupAnswers,
  sharedPoints,
  hasAnswer,
  isGradable,
  isManuallyGraded,
  maxPointsFor,
  nextPendingIndex,
} from "@/app/lib/survey/grading";
import type { Question, SurveyResponseDto } from "@/app/types/survey";

const q = (patch: Partial<Question>): Question =>
  ({ id: "q", type: "short-answer", title: "Q", required: false, order: 0, ...patch }) as Question;

describe("isManuallyGraded", () => {
  it("always grades paragraphs by hand", () => {
    expect(isManuallyGraded(q({ type: "long-answer" }))).toBe(true);
  });

  it("grades file uploads and key-less short answers only when opted in", () => {
    expect(isManuallyGraded(q({ type: "file-upload" }))).toBe(false);
    expect(isManuallyGraded(q({ type: "file-upload", settings: { manualGrading: true } }))).toBe(true);
    expect(isManuallyGraded(q({ settings: { manualGrading: true } }))).toBe(true);
  });

  it("leaves questions with an answer key to automatic scoring", () => {
    expect(
      isManuallyGraded(q({ correctAnswers: ["Paris"], settings: { manualGrading: true } })),
    ).toBe(false);
    expect(isManuallyGraded(q({ type: "checkboxes", settings: { manualGrading: true } }))).toBe(false);
  });
});

describe("isGradable", () => {
  it("lets teachers override auto-scored answers outside live mode", () => {
    expect(isGradable(q({ correctAnswers: ["SQL"] }), false)).toBe(true);
    expect(isGradable(q({ correctAnswers: ["SQL"] }), true)).toBe(false);
    expect(isGradable(q({ type: "long-answer" }), true)).toBe(true);
    expect(isGradable(q({ type: "rating" }), false)).toBe(false);
  });
});

describe("formatResultCode", () => {
  it("splits result codes for readability", () => {
    expect(formatResultCode("ABCDEF")).toBe("ABC-DEF");
    expect(formatResultCode("ABCDEFGH")).toBe("ABCD-EFGH");
    expect(formatResultCode("ABC")).toBe("ABC");
  });
});

describe("maxPointsFor", () => {
  it("defaults to one point, but keeps zero", () => {
    expect(maxPointsFor(q({}))).toBe(1);
    expect(maxPointsFor(q({ points: 0 }))).toBe(0);
    expect(maxPointsFor(q({ points: 5 }))).toBe(5);
  });
});

describe("hasAnswer", () => {
  it("treats blank text and empty lists as unanswered", () => {
    expect(hasAnswer("  ")).toBe(false);
    expect(hasAnswer([])).toBe(false);
    expect(hasAnswer(null)).toBe(false);
    expect(hasAnswer("x")).toBe(true);
    expect(hasAnswer(0)).toBe(true);
  });
});

describe("nextPendingIndex", () => {
  const r = (id: string, gradingPending?: boolean) =>
    ({ id, submittedAt: "", answers: [], gradingPending }) as SurveyResponseDto;

  it("finds the next ungraded submission, wrapping around", () => {
    const list = [r("a", true), r("b"), r("c", true)];
    expect(nextPendingIndex(list, 0)).toBe(2);
    expect(nextPendingIndex(list, 2)).toBe(0);
  });

  it("returns -1 when everything is graded", () => {
    expect(nextPendingIndex([r("a"), r("b")], 0)).toBe(-1);
  });
});

const resp = (id: string, value: unknown, awardedPoints: number | null = null): SurveyResponseDto =>
  ({ id, submittedAt: "2026-11-06T10:00:00Z", answers: value === undefined ? [] : [{ questionId: "q", value, awardedPoints }] }) as SurveyResponseDto;

describe("groupAnswers", () => {
  it("groups identical answers, ignoring extra whitespace but not case", () => {
    const groups = groupAnswers(q({}), [
      resp("1", "Primary key"),
      resp("2", "  Primary   key "),
      resp("3", "primary key"),
      resp("4", ""),
      resp("5", undefined),
    ]);
    expect(groups.map((g) => g.responses.map((r) => r.id))).toEqual([["1", "2"], ["3"]]);
  });

  it("groups checkbox answers regardless of selection order", () => {
    const question = q({ type: "checkboxes" });
    expect(answerKey(question, ["b", "a"])).toBe(answerKey(question, ["a", "b"]));
    expect(groupAnswers(question, [resp("1", ["b", "a"]), resp("2", ["a", "b"])])).toHaveLength(1);
  });

  it("keeps answers apart that were scored differently", () => {
    const withPoints = (id: string, value: string, autoPoints: number) =>
      ({ id, submittedAt: "x", answers: [{ questionId: "q", value, autoPoints }] }) as SurveyResponseDto;
    const groups = groupAnswers(q({ correctAnswers: ["Primary key"] }), [
      withPoints("1", "Primary key", 1),
      withPoints("2", "Primary  key", 0),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("never groups file uploads", () => {
    const file = [{ key: "k", url: "", filename: "a.pdf" }];
    expect(groupAnswers(q({ type: "file-upload" }), [resp("1", file), resp("2", file)])).toHaveLength(2);
  });
});

describe("sharedPoints", () => {
  it("returns the common grade or mixed", () => {
    expect(sharedPoints(q({}), [resp("1", "x", 2), resp("2", "x", 2)])).toBe(2);
    expect(sharedPoints(q({}), [resp("1", "x"), resp("2", "x")])).toBeNull();
    expect(sharedPoints(q({}), [resp("1", "x", 2), resp("2", "x", 1)])).toBe("mixed");
  });
});

describe("zero-point questions", () => {
  const paragraph = (points: number | undefined) =>
    ({ id: "p", type: "long-answer", title: "Anything else?", required: false, order: 0, points }) as Question;

  it("are worth nothing and need no grading, while unset points stay 1", () => {
    expect(maxPointsFor(paragraph(0))).toBe(0);
    expect(isGradable(paragraph(0), false)).toBe(false);
    expect(maxPointsFor(paragraph(undefined))).toBe(1);
    expect(isGradable(paragraph(undefined), false)).toBe(true);
  });
});
