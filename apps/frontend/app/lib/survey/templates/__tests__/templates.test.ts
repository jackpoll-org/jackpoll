import { describe, it, expect } from "vitest";
import {
  curatedTemplates,
  instantiateTemplate,
} from "@/app/lib/survey/templates";

describe("curated templates", () => {
  it("localizes German templates with the same ids", () => {
    const en = curatedTemplates("en");
    const de = curatedTemplates("de");
    expect(de.map((t) => t.id)).toEqual(en.map((t) => t.id));
    expect(de[0].name).not.toBe(en[0].name);
  });

  it("ships at least five templates with required fields", () => {
    expect(curatedTemplates("en").length).toBeGreaterThanOrEqual(5);
    for (const t of curatedTemplates("en")) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.questions.length).toBeGreaterThan(0);
    }
  });

  it("instantiates with fresh, unique ids and sequential order", () => {
    const template = curatedTemplates("en")[0];
    const a = instantiateTemplate(template).questions;
    const b = instantiateTemplate(template).questions;

    // order is 0..n-1
    expect(a.map((q) => q.order)).toEqual(a.map((_, i) => i));
    // two instantiations share no question ids
    const aIds = new Set(a.map((q) => q.id));
    expect(b.some((q) => aIds.has(q.id))).toBe(false);
    // ids differ from the template's placeholder ids
    expect(a[0].id).not.toBe(template.questions[0].id);
  });

  it("remaps quiz correct answers to the new option ids", () => {
    const quiz = curatedTemplates("en").find((t) => t.id === "quiz-round")!;
    const questions = instantiateTemplate(quiz).questions;
    const mc = questions[0];
    // correct answer references one of the freshly generated option ids
    expect(mc.options!.map((o) => o.id)).toContain(mc.correctAnswers![0]);
    // text-based correct answer is preserved
    expect(questions[1].correctAnswers).toEqual(["4"]);
  });

  it("brings a saved template's pages along", () => {
    const template = {
      ...curatedTemplates("en")[0],
      sections: [{ id: "page-2", title: "Reflexion", order: 0 }],
    };
    template.questions = template.questions.map((q, i) => ({ ...q, sectionId: i === 0 ? "page-2" : null }));
    const { questions, sections } = instantiateTemplate(template);
    expect(sections).toEqual(template.sections);
    expect(questions[0].sectionId).toBe("page-2");
  });
});
