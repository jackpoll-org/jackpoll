import { describe, it, expect } from "vitest";
import {
  BUILDER_QUESTION_TYPES,
  QUESTION_TYPES,
  getQuestionTypeDefinition,
} from "../registry";
import type { QuestionType } from "@/app/types/survey";

describe("question type registry", () => {
  it("exposes all builder question types", () => {
    expect(BUILDER_QUESTION_TYPES).toEqual([
      "short-answer",
      "multiple-choice",
      "checkboxes",
      "dropdown",
      "multiple-choice-grid",
      "checkbox-grid",
      "file-upload",
      "slider",
      "rating",
      "date",
      "ranking",
      "rating-grid",
      "signature",
      "wordcloud",
    ]);
  });

  it("provides a complete definition for every builder type", () => {
    for (const type of BUILDER_QUESTION_TYPES) {
      const def = getQuestionTypeDefinition(type);
      expect(def.type).toBe(type);
      expect(def.label).toBeTruthy();
      expect(def.Editor).toBeTypeOf("function");
      expect(def.Preview).toBeTypeOf("function");
    }
  });

  it("seeds choice types with one option and grid types with rows/columns", () => {
    expect(QUESTION_TYPES["multiple-choice"].createDefaults().options).toHaveLength(1);
    const grid = QUESTION_TYPES["multiple-choice-grid"].createDefaults();
    expect(grid.rows).toHaveLength(1);
    expect(grid.columns).toHaveLength(1);
  });

  it("short-answer has no options or grid defaults", () => {
    const defaults = QUESTION_TYPES["short-answer"].createDefaults();
    expect(defaults.options).toBeUndefined();
    expect(defaults.rows).toBeUndefined();
  });

  it("every QuestionType union member is registered", () => {
    const types: QuestionType[] = [
      "short-answer",
      "multiple-choice",
      "checkboxes",
      "dropdown",
      "multiple-choice-grid",
      "checkbox-grid",
      "file-upload",
    ];
    for (const t of types) {
      expect(QUESTION_TYPES[t]).toBeDefined();
    }
  });
});
