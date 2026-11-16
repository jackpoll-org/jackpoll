import { describe, it, expect } from "vitest";
import type { Question, Section, Survey } from "@/app/types/survey";
import { buildPages, questionsInPageOrder } from "../pagination";
import cases from "./fixtures/page-order.json";

interface FixtureCase {
  name: string;
  conversational: boolean;
  sections: { id: string | null; order: number }[];
  questions: { id: string; sectionId?: string | null }[];
  expected: string[];
}

function toSurvey(c: FixtureCase): Survey {
  return {
    id: "s",
    title: "S",
    status: "published",
    settings: { conversational: c.conversational },
    sections: c.sections.map((s) => ({ ...s, title: `Title ${s.id}` }) as Section),
    questions: c.questions.map(
      (q, order) => ({ type: "short-answer", title: q.id, required: false, order, ...q }) as Question,
    ),
  } as unknown as Survey;
}

describe("page order parity fixture (shared with SurveyPagesTest.java)", () => {
  it.each(cases as FixtureCase[])("$name", (c) => {
    const survey = toSurvey(c);
    expect(questionsInPageOrder(survey).map((q) => q.id)).toEqual(c.expected);
  });

  it.each(cases as FixtureCase[])("the player shows each question at most once: $name", (c) => {
    const ids = buildPages(toSurvey(c), {}).flatMap((p) => p.questions.map((q) => q.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lays out many pages in linear time", () => {
    const n = 50_000;
    const survey = toSurvey({
      name: "scale",
      conversational: false,
      sections: Array.from({ length: n }, (_, i) => ({ id: `s${i}`, order: n - i })),
      questions: Array.from({ length: n }, (_, i) => ({ id: `q${i}`, sectionId: `s${i}` })),
      expected: [],
    });
    const start = performance.now();
    const order = questionsInPageOrder(survey);
    expect(performance.now() - start).toBeLessThan(2000);
    expect(order[0].id).toBe(`q${n - 1}`);
  });
});
