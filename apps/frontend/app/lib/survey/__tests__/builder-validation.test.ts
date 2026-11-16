import { describe, it, expect } from "vitest";
import { MAX_QUESTIONS, MAX_SECTIONS, validateSurveyForSave } from "../builder-validation";
import type { Survey, Question } from "@/app/types/survey";
import type { TranslateFn } from "@/app/i18n/context";

// Echo translator: returns "key" or "key:{...params}" so assertions are simple.
const t: TranslateFn = ((key: string, params?: Record<string, string>) =>
  params ? `${key}:${JSON.stringify(params)}` : key) as TranslateFn;

function question(overrides: Partial<Question>): Question {
  return {
    id: "q1",
    type: "short-answer",
    title: "Q",
    required: false,
    order: 0,
    ...overrides,
  } as Question;
}

function survey(overrides: Partial<Survey>): Survey {
  return {
    id: "s1",
    title: "My survey",
    status: "draft",
    settings: {},
    questions: [],
    sections: [],
    ...overrides,
  } as unknown as Survey;
}

describe("validateSurveyForSave", () => {
  it("returns no issues for a valid survey", () => {
    const s = survey({ questions: [question({ title: "Name?" })] });
    expect(validateSurveyForSave(s, t, true)).toEqual([]);
  });

  it("flags a blank survey title even on a draft save", () => {
    const issues = validateSurveyForSave(survey({ title: "   " }), t, false);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe("builder.validation.surveyTitle");
    expect(issues[0].questionId).toBeUndefined();
  });

  it("allows a draft with untitled questions / empty options (forPublish=false)", () => {
    const s = survey({
      questions: [
        question({ id: "q2", title: "" }),
        question({
          id: "q3",
          type: "multiple-choice",
          options: [{ id: "o1", label: "" }],
        }),
      ],
    });
    expect(validateSurveyForSave(s, t, false)).toEqual([]);
  });

  it("flags a blank question title on publish", () => {
    const s = survey({
      questions: [question({ title: "ok" }), question({ id: "q2", title: "" })],
    });
    const issues = validateSurveyForSave(s, t, true);
    expect(issues).toHaveLength(1);
    expect(issues[0].questionId).toBe("q2");
    expect(issues[0].message).toBe('builder.validation.questionTitle:{"n":"2"}');
  });

  it("numbers questions in the player's page order", () => {
    const s = survey({
      sections: [{ id: "p2", title: "Two", order: 0 }],
      questions: [question({ id: "late", title: "", sectionId: "p2" }), question({ id: "early", title: "ok" })],
    });
    const issues = validateSurveyForSave(s, t, true);
    expect(issues[0].questionId).toBe("late");
    expect(issues[0].message).toBe('builder.validation.questionTitle:{"n":"2"}');
  });

  it("flags a blank option label on publish", () => {
    const s = survey({
      questions: [
        question({
          type: "multiple-choice",
          options: [
            { id: "o1", label: "A" },
            { id: "o2", label: "  " },
          ],
        }),
      ],
    });
    const issues = validateSurveyForSave(s, t, true);
    expect(issues.map((i) => i.message)).toContain(
      'builder.validation.optionLabel:{"n":"1"}',
    );
  });

  it("collects multiple issues across the survey on publish", () => {
    const s = survey({
      title: "",
      questions: [question({ title: "" })],
    });
    expect(validateSurveyForSave(s, t, true)).toHaveLength(2);
  });
});

describe("validateSurveyForSave completion buttons", () => {
  const withButtons = (completionButtons: unknown[]) =>
    survey({ settings: { completionButtons } as unknown as Survey["settings"] });

  it("flags an unsafe link even on a draft save", () => {
    const issues = validateSurveyForSave(
      withButtons([
        { id: "b", label: "Go", action: "url", url: "javascript:x", enabled: false },
        { id: "c", label: "Go", action: "close", url: "javascript:x", enabled: true },
      ]),
      t,
      false,
    );
    expect(issues.map((i) => i.message)).toEqual([
      'builder.validation.buttonUrlInvalid:{"n":"1"}',
    ]);
  });

  it("allows incomplete buttons in a draft", () => {
    expect(
      validateSurveyForSave(withButtons([{ id: "b", label: "", action: "url", enabled: true }]), t, false),
    ).toEqual([]);
  });

  it("requires a label and link for enabled buttons when publishing", () => {
    const issues = validateSurveyForSave(
      withButtons([
        { id: "a", label: "", action: "close", enabled: true },
        { id: "b", label: "Go", action: "url", url: " ", enabled: true },
        { id: "c", label: "", action: "url", enabled: false },
      ]),
      t,
      true,
    );
    expect(issues.map((i) => i.message)).toEqual([
      'builder.validation.buttonIncomplete:{"n":"1"}',
      'builder.validation.buttonIncomplete:{"n":"2"}',
    ]);
  });

  it("flags surveys over the question and page limits, even as drafts", () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => question({ id: `q${i}` }));
    const pages = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, order: i }));
    expect(validateSurveyForSave(survey({ questions: many(MAX_QUESTIONS), sections: pages(MAX_SECTIONS) } as Partial<Survey>), t, false)).toEqual([]);
    expect(
      validateSurveyForSave(survey({ questions: many(MAX_QUESTIONS + 1), sections: pages(MAX_SECTIONS + 1) } as Partial<Survey>), t, false).map((i) => i.message),
    ).toEqual([
      'builder.validation.tooManyQuestions:{"max":"2000"}',
      'builder.validation.tooManyPages:{"max":"500"}',
    ]);
  });
});
