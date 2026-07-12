import { describe, it, expect } from "vitest";
import {
  createSurveySchema,
  optionSchema,
  questionSchema,
  updateSurveySchema,
} from "@/app/lib/survey/schemas";

describe("createSurveySchema", () => {
  it("accepts a valid title", () => {
    const result = createSurveySchema.safeParse({ title: "My Survey" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty title", () => {
    const result = createSurveySchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });
});

describe("optionSchema", () => {
  it("rejects an empty label", () => {
    expect(optionSchema.safeParse({ id: "o1", label: "" }).success).toBe(false);
  });
});

describe("questionSchema", () => {
  it("accepts a multiple-choice question with options", () => {
    const result = questionSchema.safeParse({
      id: "q1",
      type: "multiple-choice",
      title: "Pick one",
      required: true,
      order: 0,
      options: [{ id: "o1", label: "A" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown question type", () => {
    const result = questionSchema.safeParse({
      id: "q1",
      type: "nonexistent-type",
      title: "Bad",
      required: false,
      order: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("updateSurveySchema", () => {
  it("accepts a survey with grid rows and columns", () => {
    const result = updateSurveySchema.safeParse({
      title: "Grid survey",
      status: "draft",
      questions: [
        {
          id: "q1",
          type: "multiple-choice-grid",
          title: "Rate",
          required: false,
          order: 0,
          rows: [{ id: "r1", label: "Speed" }],
          columns: [{ id: "c1", label: "Good" }],
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});
