import { describe, it, expect } from "vitest";
import type { Question, Section, Survey } from "@/app/types/survey";
import { isInfoSlide, liveSlides, questionNumber } from "../slides";

function q(id: string, type: Question["type"], order: number, sectionId: string | null = null): Question {
  return { id, type, title: id, required: false, order, sectionId } as Question;
}

function survey(questions: Question[], sections: Section[] = [], conversational = false): Survey {
  return { id: "s", questions, sections, settings: { conversational } } as unknown as Survey;
}

describe("live slides", () => {
  const slides = liveSlides(
    survey([
      q("intro", "content", 0),
      q("q1", "multiple-choice", 1),
      q("q2", "multiple-choice", 2),
      q("break", "content", 3),
      q("q3", "slider", 4),
    ]),
  );

  it("keeps content blocks as slides in survey order", () => {
    expect(slides.map((s) => s.id)).toEqual(["intro", "q1", "q2", "break", "q3"]);
  });

  it("follows the page order of the player, not the creation order", () => {
    const paged = liveSlides(
      survey(
        [
          q("first-created", "multiple-choice", 0, "p2"),
          q("info", "content", 1, "p1"),
          q("second-created", "multiple-choice", 2, "p1"),
          q("ungrouped", "multiple-choice", 3),
          q("orphan", "multiple-choice", 4, "gone"),
        ],
        [
          { id: "p2", title: "Two", order: 1 },
          { id: "p1", title: "One", order: 0 },
        ],
      ),
    );
    expect(paged.map((s) => s.id)).toEqual([
      "ungrouped",
      "info",
      "second-created",
      "first-created",
      "orphan",
    ]);
  });

  it("does not mutate the survey's questions", () => {
    const input = [q("b", "dropdown", 1, "p2"), q("a", "dropdown", 0, "p1")];
    liveSlides(survey(input, [{ id: "p1", order: 0 }, { id: "p2", order: 1 }]));
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
