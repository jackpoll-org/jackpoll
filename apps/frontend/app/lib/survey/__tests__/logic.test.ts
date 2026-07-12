import { describe, it, expect } from "vitest";
import {
  evaluateCondition,
  getLogicRule,
  hasLogic,
  isQuestionVisible,
  withLogicRule,
} from "@/app/lib/survey/logic";
import type { LogicRule, Question } from "@/app/types/survey";

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
