import { describe, it, expect } from "vitest";
import {
  getValidationRules,
  rulesForType,
  validateAnswer,
  withValidationRules,
} from "@/app/lib/survey/validation";
import type { Question } from "@/app/types/survey";

function q(overrides: Partial<Question>): Question {
  return {
    id: "q1",
    type: "short-answer",
    title: "Q",
    required: false,
    order: 0,
    ...overrides,
  };
}

describe("rulesForType", () => {
  it("returns length/pattern rules for short-answer", () => {
    expect(rulesForType("short-answer")).toEqual(["minLength", "maxLength", "pattern"]);
  });
  it("returns selection rules for checkboxes", () => {
    expect(rulesForType("checkboxes")).toEqual(["minSelected", "maxSelected"]);
  });
  it("returns no configurable rules for dropdown", () => {
    expect(rulesForType("dropdown")).toEqual([]);
  });
});

describe("required", () => {
  it("flags an empty required answer", () => {
    expect(validateAnswer(q({ required: true }), "")).toBe("This question is required.");
    expect(validateAnswer(q({ required: true, type: "checkboxes" }), [])).toBe(
      "This question is required.",
    );
  });
  it("passes a non-empty required answer", () => {
    expect(validateAnswer(q({ required: true }), "hi")).toBeNull();
  });
  it("skips rules for an empty optional answer", () => {
    const question = q({
      settings: { validation: [{ type: "minLength", value: 5 }] },
    });
    expect(validateAnswer(question, "")).toBeNull();
  });
});

describe("text rules", () => {
  const question = q({
    settings: {
      validation: [
        { type: "minLength", value: 3 },
        { type: "maxLength", value: 6 },
      ],
    },
  });
  it("enforces minLength", () => {
    expect(validateAnswer(question, "ab")).toBe("Must be at least 3 characters.");
  });
  it("enforces maxLength", () => {
    expect(validateAnswer(question, "abcdefg")).toBe("Must be at most 6 characters.");
  });
  it("accepts a value within bounds", () => {
    expect(validateAnswer(question, "abcd")).toBeNull();
  });
  it("applies a pattern with a custom message", () => {
    const email = q({
      settings: {
        validation: [
          { type: "pattern", pattern: "^[^@]+@[^@]+$", message: "Enter an email" },
        ],
      },
    });
    expect(validateAnswer(email, "nope")).toBe("Enter an email");
    expect(validateAnswer(email, "a@b")).toBeNull();
  });
  it("ignores an invalid regex instead of blocking", () => {
    const bad = q({ settings: { validation: [{ type: "pattern", pattern: "(" }] } });
    expect(validateAnswer(bad, "anything")).toBeNull();
  });
});

describe("selection rules", () => {
  const question = q({
    type: "checkboxes",
    settings: {
      validation: [
        { type: "minSelected", value: 2 },
        { type: "maxSelected", value: 3 },
      ],
    },
  });
  it("enforces minSelected", () => {
    expect(validateAnswer(question, ["a"])).toBe("Select at least 2 option(s).");
  });
  it("enforces maxSelected", () => {
    expect(validateAnswer(question, ["a", "b", "c", "d"])).toBe(
      "Select at most 3 option(s).",
    );
  });
  it("accepts a valid selection count", () => {
    expect(validateAnswer(question, ["a", "b"])).toBeNull();
  });
});

describe("localized messages (#57)", () => {
  // Fake translator: echoes the key + interpolates {count}.
  const t = ((key: string, params?: Record<string, string | number>) =>
    params?.count != null ? `${key}:${params.count}` : key) as never;

  it("uses the translator for the required message", () => {
    expect(validateAnswer(q({ required: true }), "", t)).toBe("validation.required");
  });

  it("uses the translator + count for rule messages", () => {
    const question = q({
      type: "checkboxes",
      settings: { validation: [{ type: "minSelected", value: 2 }] },
    });
    expect(validateAnswer(question, ["a"], t)).toBe("validation.minSelected:2");
  });

  it("a custom author message still wins over translation", () => {
    const question = q({
      type: "short-answer",
      settings: { validation: [{ type: "minLength", value: 5, message: "Zu kurz!" }] },
    });
    expect(validateAnswer(question, "ab", t)).toBe("Zu kurz!");
  });

  it("falls back to English when no translator is given", () => {
    expect(validateAnswer(q({ required: true }), "")).toBe("This question is required.");
  });
});

describe("slider answers", () => {
  const slider = q({ type: "slider", required: true, settings: { min: 0, max: 10 } });

  it("treats any number — including 0 — as a valid answer", () => {
    expect(validateAnswer(slider, 0)).toBeNull();
    expect(validateAnswer(slider, 7)).toBeNull();
  });

  it("flags a missing slider answer when required", () => {
    expect(validateAnswer(slider, undefined)).toBe("This question is required.");
  });
});

describe("rule storage helpers", () => {
  it("round-trips rules through settings", () => {
    const rules = [{ type: "minLength" as const, value: 4 }];
    const settings = withValidationRules(q({}), rules);
    const question = q({ settings });
    expect(getValidationRules(question)).toEqual(rules);
  });
  it("preserves other settings keys", () => {
    const question = q({ settings: { foo: "bar" } });
    const settings = withValidationRules(question, [{ type: "maxLength", value: 2 }]);
    expect(settings.foo).toBe("bar");
  });
});
