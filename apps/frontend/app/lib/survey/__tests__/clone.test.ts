import { describe, it, expect } from "vitest";
import { cloneQuestions } from "@/app/lib/survey/clone";
import { getLogicRule } from "@/app/lib/survey/logic";
import type { Question } from "@/app/types/survey";

function sourceQuestions(): Question[] {
  return [
    {
      id: "q1",
      type: "multiple-choice",
      title: "Do you like it?",
      required: true,
      order: 0,
      options: [
        { id: "o1", label: "Yes" },
        { id: "o2", label: "No" },
      ],
      correctAnswers: ["o1"],
    },
    {
      id: "q2",
      type: "short-answer",
      title: "Why?",
      required: false,
      order: 1,
      settings: {
        logic: {
          match: "all",
          conditions: [{ questionId: "q1", operator: "equals", value: "o1" }],
        },
      },
    },
  ];
}

describe("cloneQuestions", () => {
  it("regenerates question and option ids", () => {
    const cloned = cloneQuestions(sourceQuestions());
    expect(cloned[0].id).not.toBe("q1");
    expect(cloned[1].id).not.toBe("q2");
    expect(cloned[0].options!.map((o) => o.id)).not.toContain("o1");
    // order preserved
    expect(cloned.map((q) => q.order)).toEqual([0, 1]);
  });

  it("remaps quiz correct answers to the new option ids", () => {
    const cloned = cloneQuestions(sourceQuestions());
    const yesId = cloned[0].options![0].id;
    expect(cloned[0].correctAnswers).toEqual([yesId]);
  });

  it("remaps conditional-logic question and option references", () => {
    const cloned = cloneQuestions(sourceQuestions());
    const newQ1Id = cloned[0].id;
    const yesId = cloned[0].options![0].id;
    const rule = getLogicRule(cloned[1]);
    expect(rule).not.toBeNull();
    expect(rule!.conditions[0].questionId).toBe(newQ1Id);
    expect(rule!.conditions[0].value).toBe(yesId);
  });

  it("produces independent copies on repeated calls", () => {
    const a = cloneQuestions(sourceQuestions());
    const b = cloneQuestions(sourceQuestions());
    expect(a[0].id).not.toBe(b[0].id);
  });
});
