import { describe, it, expect } from "vitest";
import {
  CURATED_TEMPLATES,
  instantiateTemplateQuestions,
} from "@/app/lib/survey/templates";

describe("curated templates", () => {
  it("ships at least five templates with required fields", () => {
    expect(CURATED_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    for (const t of CURATED_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.questions.length).toBeGreaterThan(0);
    }
  });

  it("instantiates with fresh, unique ids and sequential order", () => {
    const template = CURATED_TEMPLATES[0];
    const a = instantiateTemplateQuestions(template);
    const b = instantiateTemplateQuestions(template);

    // order is 0..n-1
    expect(a.map((q) => q.order)).toEqual(a.map((_, i) => i));
    // two instantiations share no question ids
    const aIds = new Set(a.map((q) => q.id));
    expect(b.some((q) => aIds.has(q.id))).toBe(false);
    // ids differ from the template's placeholder ids
    expect(a[0].id).not.toBe(template.questions[0].id);
  });

  it("remaps quiz correct answers to the new option ids", () => {
    const quiz = CURATED_TEMPLATES.find((t) => t.id === "quiz-round")!;
    const questions = instantiateTemplateQuestions(quiz);
    const mc = questions[0];
    // correct answer references one of the freshly generated option ids
    expect(mc.options!.map((o) => o.id)).toContain(mc.correctAnswers![0]);
    // text-based correct answer is preserved
    expect(questions[1].correctAnswers).toEqual(["4"]);
  });
});
