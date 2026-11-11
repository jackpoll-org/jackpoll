import { describe, it, expect } from "vitest";
import {
  isAutoScored,
  maxPointsFor,
  seededOptionPoints,
  withOptionPoints,
  withoutOptionPoints,
} from "@/app/lib/survey/grading";
import type { Question } from "@/app/types/survey";

const q = (patch: Partial<Question>): Question =>
  ({ id: "q", type: "multiple-choice", title: "Q", required: false, order: 0, ...patch }) as Question;

const options = [
  { id: "a", label: "A" },
  { id: "b", label: "B" },
  { id: "c", label: "C" },
];

describe("points per answer", () => {
  it("derives the maximum like the server", () => {
    expect(maxPointsFor(q({ options, points: 9, settings: { optionPoints: { a: 0, b: 2, c: 1 } } }))).toBe(2);
    expect(maxPointsFor(q({ type: "checkboxes", options, settings: { optionPoints: { a: 1, b: -1, c: 1 } } }))).toBe(2);
    expect(
      maxPointsFor(
        q({ type: "short-answer", points: 2, correctAnswers: ["x", "y"], settings: { answerPoints: { y: 1 } } }),
      ),
    ).toBe(2);
    expect(maxPointsFor(q({ points: 3 }))).toBe(3);
  });

  it("ignores points of removed options and blank accepted answers", () => {
    expect(maxPointsFor(q({ type: "checkboxes", options, settings: { optionPoints: { a: 1, gone: 9 } } }))).toBe(1);
    expect(
      maxPointsFor(q({ type: "short-answer", points: 1, correctAnswers: ["", "x"], settings: { answerPoints: { "": 5 } } })),
    ).toBe(1);
    expect(
      maxPointsFor(q({ type: "short-answer", points: 1, correctAnswers: ["constructor"], settings: { answerPoints: { x: 3 } } })),
    ).toBe(1);
  });

  it("counts option points and a scored order as an answer key", () => {
    expect(isAutoScored(q({ type: "checkboxes", options, settings: { optionPoints: { a: 1 } } }))).toBe(true);
    expect(isAutoScored(q({ type: "checkboxes", options, settings: { optionPoints: { a: 0 } } }))).toBe(false);
    expect(isAutoScored(q({ type: "ranking", settings: { scoreOrder: true } }))).toBe(true);
    expect(isAutoScored(q({ type: "ranking" }))).toBe(false);
  });

  it("starts option points from the current answer key", () => {
    expect(seededOptionPoints(q({ options, points: 3, correctAnswers: ["b"] }))).toEqual({ a: 0, b: 3, c: 0 });
    expect(seededOptionPoints(q({ type: "checkboxes", options, points: 4, correctAnswers: ["a", "c"] }))).toEqual({
      a: 2,
      b: -2,
      c: 2,
    });
  });

  it("updates one option's points and drops points of removed options", () => {
    const question = q({ options, correctAnswers: ["b"], settings: { tolerance: 1 } });
    expect(withOptionPoints(question, "c", 1)).toEqual({
      settings: { tolerance: 1, optionPoints: { a: 0, b: 1, c: 1 } },
      correctAnswers: ["b", "c"],
    });
    const pruned = q({ options: options.slice(0, 2), settings: { optionPoints: { a: 1, b: 0, gone: 4 } } });
    expect(withOptionPoints(pruned, "a", 2)).toEqual({ settings: { optionPoints: { a: 2, b: 0 } }, correctAnswers: ["a"] });
    expect(withoutOptionPoints(pruned)).toEqual({});
  });
});
