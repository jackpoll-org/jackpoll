import { describe, it, expect } from "vitest";
import { cloneContent } from "@/app/lib/survey/clone";
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

describe("cloneContent", () => {
  it("regenerates question and option ids", () => {
    const cloned = cloneContent(sourceQuestions()).questions;
    expect(cloned[0].id).not.toBe("q1");
    expect(cloned[1].id).not.toBe("q2");
    expect(cloned[0].options!.map((o) => o.id)).not.toContain("o1");
    // order preserved
    expect(cloned.map((q) => q.order)).toEqual([0, 1]);
  });

  it("remaps quiz correct answers to the new option ids", () => {
    const cloned = cloneContent(sourceQuestions()).questions;
    const yesId = cloned[0].options![0].id;
    expect(cloned[0].correctAnswers).toEqual([yesId]);
  });

  it("remaps conditional-logic question and option references", () => {
    const cloned = cloneContent(sourceQuestions()).questions;
    const newQ1Id = cloned[0].id;
    const yesId = cloned[0].options![0].id;
    const rule = getLogicRule(cloned[1]);
    expect(rule).not.toBeNull();
    expect(rule!.conditions[0].questionId).toBe(newQ1Id);
    expect(rule!.conditions[0].value).toBe(yesId);
  });

  it("produces independent copies on repeated calls", () => {
    const a = cloneContent(sourceQuestions()).questions;
    const b = cloneContent(sourceQuestions()).questions;
    expect(a[0].id).not.toBe(b[0].id);
  });

  it("keeps sections and points their visibility rules at the copied questions", () => {
    const source = sourceQuestions().map((q) => ({ ...q, sectionId: q.id === "q2" ? "reflexion" : null }));
    const { questions, sections } = cloneContent(source, [
      {
        id: "reflexion",
        title: "Reflexion",
        order: 0,
        visibleIf: { match: "all", conditions: [{ questionId: "q1", operator: "equals", value: "o1" }] },
      },
    ]);
    expect(sections[0].id).toBe("reflexion");
    expect(sections[0].title).toBe("Reflexion");
    expect(sections[0].visibleIf!.conditions[0].questionId).toBe(questions[0].id);
    expect(sections[0].visibleIf!.conditions[0].value).toBe(questions[0].options![0].id);
    expect(questions[1].sectionId).toBe("reflexion");
  });
});
