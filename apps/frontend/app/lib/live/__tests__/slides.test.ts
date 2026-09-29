import { describe, it, expect } from "vitest";
import type { Question } from "@/app/types/survey";
import { isInfoSlide, liveSlides, questionNumber } from "../slides";

function q(id: string, type: Question["type"], order: number): Question {
  return { id, type, title: id, required: false, order } as Question;
}

describe("live slides", () => {
  const slides = liveSlides([
    q("q2", "multiple-choice", 2),
    q("intro", "content", 0),
    q("q1", "multiple-choice", 1),
    q("break", "content", 3),
    q("q3", "slider", 4),
  ]);

  it("keeps content blocks as slides, sorted by order", () => {
    expect(slides.map((s) => s.id)).toEqual(["intro", "q1", "q2", "break", "q3"]);
  });

  it("does not mutate the input array", () => {
    const input = [q("b", "dropdown", 1), q("a", "dropdown", 0)];
    liveSlides(input);
    expect(input.map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("flags content blocks as info slides", () => {
    expect(isInfoSlide(slides[0])).toBe(true);
    expect(isInfoSlide(slides[1])).toBe(false);
    expect(isInfoSlide(undefined)).toBe(false);
  });

  it("numbers only the real questions", () => {
    expect(questionNumber(slides, 1)).toEqual({ current: 1, total: 3 });
    expect(questionNumber(slides, 2)).toEqual({ current: 2, total: 3 });
    expect(questionNumber(slides, 4)).toEqual({ current: 3, total: 3 });
  });
});
