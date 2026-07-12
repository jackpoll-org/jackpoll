import { describe, it, expect } from "vitest";
import { buildPages } from "../pagination";
import type { Question, Section, Survey } from "@/app/types/survey";

function q(id: string, sectionId?: string | null, extra: Partial<Question> = {}): Question {
  return {
    id,
    type: "short-answer",
    title: id,
    required: false,
    order: 0,
    sectionId: sectionId ?? null,
    ...extra,
  };
}

function survey(questions: Question[], sections?: Section[]): Survey {
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
    },
    questions,
    sections,
    createdAt: "",
    updatedAt: "",
  };
}

describe("buildPages", () => {
  it("returns a single page for flat surveys", () => {
    const pages = buildPages(survey([q("a"), q("b")]), {});
    expect(pages).toHaveLength(1);
    expect(pages[0].sectionId).toBeNull();
    expect(pages[0].questions.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("groups questions into section pages in order", () => {
    const sections: Section[] = [
      { id: "s2", title: "Two", order: 1 },
      { id: "s1", title: "One", order: 0 },
    ];
    const pages = buildPages(
      survey([q("a", "s1"), q("b", "s2"), q("c", "s1")], sections),
      {},
    );
    expect(pages.map((p) => p.sectionId)).toEqual(["s1", "s2"]);
    expect(pages[0].questions.map((x) => x.id)).toEqual(["a", "c"]);
    expect(pages[1].questions.map((x) => x.id)).toEqual(["b"]);
  });

  it("puts ungrouped questions on an implicit first page", () => {
    const sections: Section[] = [{ id: "s1", title: "One", order: 0 }];
    const pages = buildPages(survey([q("loose"), q("a", "s1")], sections), {});
    expect(pages).toHaveLength(2);
    expect(pages[0].sectionId).toBeNull();
    expect(pages[0].questions.map((x) => x.id)).toEqual(["loose"]);
  });

  it("drops empty sections", () => {
    const sections: Section[] = [
      { id: "s1", title: "One", order: 0 },
      { id: "s2", title: "Empty", order: 1 },
    ];
    const pages = buildPages(survey([q("a", "s1")], sections), {});
    expect(pages.map((p) => p.sectionId)).toEqual(["s1"]);
  });

  it("conversational mode puts each visible question on its own page", () => {
    const s = survey([q("a"), q("b"), q("c")]);
    s.settings.conversational = true;
    const pages = buildPages(s, {});
    expect(pages).toHaveLength(3);
    expect(pages.map((p) => p.questions[0].id)).toEqual(["a", "b", "c"]);
    expect(pages.every((p) => p.questions.length === 1)).toBe(true);
  });

  it("skips a section hidden by its visibleIf rule", () => {
    const sections: Section[] = [
      { id: "s1", title: "One", order: 0 },
      {
        id: "s2",
        title: "Conditional",
        order: 1,
        visibleIf: {
          match: "all",
          conditions: [{ questionId: "a", operator: "equals", value: "yes" }],
        },
      },
    ];
    const questions = [q("a", "s1"), q("b", "s2")];
    expect(buildPages(survey(questions, sections), { a: "no" }).map((p) => p.sectionId)).toEqual(["s1"]);
    expect(buildPages(survey(questions, sections), { a: "yes" }).map((p) => p.sectionId)).toEqual(["s1", "s2"]);
  });
});
