import { describe, it, expect } from "vitest";
import { computeProgress } from "../progress";
import type { Question, QuestionType, Section, Survey } from "@/app/types/survey";

function q(id: string, type: QuestionType = "short-answer", extra: Partial<Question> = {}): Question {
  return { id, type, title: id, required: false, order: 0, sectionId: null, ...extra };
}

function survey(
  questions: Question[],
  sections?: Section[],
  settings: Partial<Survey["settings"]> = {},
): Survey {
  return {
    id: "s1",
    ownerId: "o1",
    title: "S",
    status: "published",
    settings: {
      allowMultipleResponses: false,
      showProgressBar: true,
      shuffleQuestions: false,
      isQuiz: false,
      showLiveResults: false,
      postSubmitSummary: false,
      showPoweredBy: false,
      rateLimit: false,
      onePerBrowser: false,
      requireCaptcha: false,
      ...settings,
    },
    questions,
    sections,
    createdAt: "",
    updatedAt: "",
  };
}

const sections: Section[] = [
  { id: "p1", title: "One", order: 0 },
  { id: "p2", title: "Two", order: 1 },
];

describe("computeProgress", () => {
  it("counts pages and answers across sections", () => {
    const s = survey(
      [q("a", "short-answer", { sectionId: "p1" }), q("b", "short-answer", { sectionId: "p2" }), q("c", "short-answer", { sectionId: "p2" })],
      sections,
    );
    expect(computeProgress(s, { a: "x", c: "  " }, 1)).toEqual({
      page: 2,
      pageCount: 2,
      question: 2,
      answered: 1,
      total: 3,
    });
  });

  it("treats a flat survey as one page", () => {
    expect(computeProgress(survey([q("a"), q("b")]), {}, 0)).toEqual({
      page: 1,
      pageCount: 1,
      question: 1,
      answered: 0,
      total: 2,
    });
  });

  it("numbers questions in conversational mode", () => {
    const s = survey([q("a"), q("intro", "content"), q("b"), q("c")], undefined, { conversational: true });
    expect(computeProgress(s, { a: "x" }, 2)).toMatchObject({ page: 3, pageCount: 4, question: 2, answered: 1, total: 3 });
    expect(computeProgress(s, {}, 1)).toMatchObject({ question: null });
  });

  it("counts a word cloud as answered once its words were sent", () => {
    const s = survey([q("a"), q("cloud", "wordcloud")]);
    expect(computeProgress(s, { a: "x" }, 0)).toMatchObject({ answered: 1, total: 2 });
    expect(computeProgress(s, { a: "x" }, 0, { sent: new Set(["cloud"]) })).toMatchObject({ answered: 2, total: 2 });
  });

  it("drops questions hidden by logic from the total", () => {
    const hidden = q("b", "short-answer", {
      settings: { logic: { match: "all", conditions: [{ questionId: "a", operator: "equals", value: "yes" }] } },
    });
    const s = survey([q("a"), hidden]);
    expect(computeProgress(s, { a: "no", b: "stale" }, 0)).toMatchObject({ answered: 1, total: 1 });
    expect(computeProgress(s, { a: "yes", b: "x" }, 0)).toMatchObject({ answered: 2, total: 2 });
  });

  it("excludes content blocks", () => {
    expect(computeProgress(survey([q("intro", "content"), q("a")]), {}, 0)).toMatchObject({ total: 1 });
    expect(computeProgress(survey([q("intro", "content")]), {}, 0)).toMatchObject({ answered: 0, total: 0 });
  });

  it("counts a slider as answered and empty checkboxes as unanswered", () => {
    const s = survey([q("slide", "slider"), q("boxes", "checkboxes")]);
    expect(computeProgress(s, { slide: 0, boxes: [] }, 0)).toMatchObject({ answered: 1, total: 2 });
    expect(computeProgress(s, { slide: 0, boxes: ["x"] }, 0)).toMatchObject({ answered: 2, total: 2 });
  });

  it("reflects preloaded draft answers on any page", () => {
    const s = survey(
      [q("a", "short-answer", { sectionId: "p1" }), q("b", "short-answer", { sectionId: "p2" })],
      sections,
    );
    expect(computeProgress(s, { a: "x", b: "y" }, 0)).toMatchObject({ page: 1, answered: 2, total: 2 });
  });

  it("clamps an out-of-range page index", () => {
    expect(computeProgress(survey([q("a")]), {}, 5)).toMatchObject({ page: 1, pageCount: 1 });
  });
});
