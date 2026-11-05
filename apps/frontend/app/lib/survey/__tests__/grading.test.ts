import { describe, it, expect } from "vitest";
import {
  formatResultCode,
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
  it("splits eight-character codes for readability", () => {
    expect(formatResultCode("ABCDEFGH")).toBe("ABCD-EFGH");
    expect(formatResultCode("ABC")).toBe("ABC");
  });
});

describe("maxPointsFor", () => {
  it("defaults to one point", () => {
    expect(maxPointsFor(q({}))).toBe(1);
    expect(maxPointsFor(q({ points: 0 }))).toBe(1);
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
