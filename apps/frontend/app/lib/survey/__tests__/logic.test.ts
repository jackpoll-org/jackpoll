import { describe, it, expect } from "vitest";
import {
  evaluateCondition,
  getLogicRule,
  getPrecedingQuestions,
  hasLogic,
  isQuestionVisible,
  withLogicRule,
} from "@/app/lib/survey/logic";
import type { LogicRule, Question, Section, Survey } from "@/app/types/survey";

function q(overrides: Partial<Question>): Question {
  return {
    id: "q2",
    type: "short-answer",
    title: "Follow-up",
    required: false,
    order: 1,
    ...overrides,
  };
}

const rule = (over: Partial<LogicRule> = {}): LogicRule => ({
  match: "all",
  conditions: [{ questionId: "q1", operator: "equals", value: "yes" }],
  ...over,
});

describe("logic storage", () => {
  it("round-trips a rule through settings and clears empties", () => {
    const settings = withLogicRule(q({}), rule());
    expect(getLogicRule(q({ settings }))).toEqual(rule());
    const cleared = withLogicRule(q({ settings }), { match: "all", conditions: [] });
    expect(cleared.logic).toBeUndefined();
    expect(hasLogic(q({ settings: cleared }))).toBe(false);
  });
});

describe("evaluateCondition", () => {
  it("equals / notEquals", () => {
    expect(evaluateCondition({ questionId: "q1", operator: "equals", value: "yes" }, { q1: "yes" })).toBe(true);
    expect(evaluateCondition({ questionId: "q1", operator: "notEquals", value: "yes" }, { q1: "no" })).toBe(true);
  });
  it("contains for checkbox arrays", () => {
    expect(evaluateCondition({ questionId: "q1", operator: "contains", value: "a" }, { q1: ["a", "b"] })).toBe(true);
    expect(evaluateCondition({ questionId: "q1", operator: "notContains", value: "c" }, { q1: ["a", "b"] })).toBe(true);
  });
  it("empty / notEmpty", () => {
    expect(evaluateCondition({ questionId: "q1", operator: "empty" }, { q1: "" })).toBe(true);
    expect(evaluateCondition({ questionId: "q1", operator: "notEmpty" }, { q1: "x" })).toBe(true);
  });
  it("greaterThan / lessThan", () => {
    expect(evaluateCondition({ questionId: "q1", operator: "greaterThan", value: "3" }, { q1: "5" })).toBe(true);
    expect(evaluateCondition({ questionId: "q1", operator: "lessThan", value: "3" }, { q1: "1" })).toBe(true);
  });
});

describe("getPrecedingQuestions", () => {
  function pq(id: string, sectionId?: string | null): Question {
    return { id, type: "short-answer", title: id, required: false, order: 0, sectionId: sectionId ?? null };
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

  it("returns questions before the target on a flat survey", () => {
    const s = survey([pq("a"), pq("b"), pq("c")]);
    expect(getPrecedingQuestions(s, "c").map((x) => x.id)).toEqual(["a", "b"]);
    expect(getPrecedingQuestions(s, "a")).toEqual([]);
  });

  it("spans earlier pages, so the first question of a later section can reference page 1", () => {
    const sections: Section[] = [{ id: "s2", title: "Two", order: 0 }];
    const s = survey([pq("a", null), pq("b", null), pq("c", "s2"), pq("d", "s2")], sections);
    // First question of section page still sees the ungrouped page-1 questions.
    expect(getPrecedingQuestions(s, "c").map((x) => x.id)).toEqual(["a", "b"]);
    // Second question of the section sees page 1 plus its own earlier sibling.
    expect(getPrecedingQuestions(s, "d").map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("orders sections by their order field, not array order", () => {
    const sections: Section[] = [
      { id: "s2", title: "Two", order: 1 },
      { id: "s1", title: "One", order: 0 },
    ];
    const s = survey([pq("x", "s2"), pq("y", "s1")], sections);
    // s1 (order 0) precedes s2 (order 1), so y comes before x.
    expect(getPrecedingQuestions(s, "x").map((q) => q.id)).toEqual(["y"]);
    expect(getPrecedingQuestions(s, "y")).toEqual([]);
  });
});

describe("isQuestionVisible", () => {
  it("is visible without a rule", () => {
    expect(isQuestionVisible(q({}), {})).toBe(true);
  });
  it("respects AND (all) combination", () => {
    const question = q({
      settings: {
        logic: {
          match: "all",
          conditions: [
            { questionId: "q1", operator: "equals", value: "yes" },
            { questionId: "qx", operator: "notEmpty" },
          ],
        },
      },
    });
    expect(isQuestionVisible(question, { q1: "yes", qx: "filled" })).toBe(true);
    expect(isQuestionVisible(question, { q1: "yes", qx: "" })).toBe(false);
  });
  it("respects OR (any) combination", () => {
    const question = q({
      settings: {
        logic: {
          match: "any",
          conditions: [
            { questionId: "q1", operator: "equals", value: "yes" },
            { questionId: "qx", operator: "equals", value: "maybe" },
          ],
        },
      },
    });
    expect(isQuestionVisible(question, { q1: "no", qx: "maybe" })).toBe(true);
    expect(isQuestionVisible(question, { q1: "no", qx: "no" })).toBe(false);
  });
});
