import type {
  Question,
  QuestionType,
  UploadedFile,
  ValidationRule,
  ValidationRuleType,
} from "@/app/types/survey";
import type { TranslateFn } from "@/app/i18n/context";

/** Answer value shapes per question type. */
export type AnswerValue =
  | string
  | number
  | string[]
  | UploadedFile[]
  | Record<string, string | string[] | number>
  | undefined
  | null;

/** Which validation rule types can be configured for a given question type. */
export function rulesForType(type: QuestionType): ValidationRuleType[] {
  switch (type) {
    case "short-answer":
      return ["minLength", "maxLength", "pattern"];
    case "checkboxes":
      return ["minSelected", "maxSelected"];
    default:
      return [];
  }
}

/** Read the validation rules stored in a question's settings JSON. */
export function getValidationRules(question: Question): ValidationRule[] {
  const raw = question.settings?.validation;
  return Array.isArray(raw) ? (raw as ValidationRule[]) : [];
}

/** Produce a settings patch that stores the given validation rules. */
export function withValidationRules(
  question: Question,
  rules: ValidationRule[],
): Record<string, unknown> {
  return { ...(question.settings ?? {}), validation: rules };
}

function isEmpty(answer: AnswerValue): boolean {
  if (answer == null) return true;
  // A slider always reports a number — including 0 — so it is never "empty".
  if (typeof answer === "number") return false;
  if (typeof answer === "string") return answer.trim() === "";
  if (Array.isArray(answer)) return answer.length === 0;
  // grid record: empty when no row has a selection
  return Object.values(answer).every((v) =>
    Array.isArray(v) ? v.length === 0 : !v,
  );
}

/** A localized validation message, falling back to English when no translator. */
function ruleMessage(
  rule: ValidationRule,
  t: TranslateFn | undefined,
  key: ValidationKey,
  fallback: string,
  params?: Record<string, string | number>,
): string {
  // An author-provided custom message always wins.
  if (rule.message?.trim()) return rule.message;
  return t ? t(key, params) : fallback;
}

type ValidationKey =
  | "validation.required"
  | "validation.minLength"
  | "validation.maxLength"
  | "validation.pattern"
  | "validation.minSelected"
  | "validation.maxSelected";

/**
 * Validate a single answer against its question's required flag and rules.
 * Returns the first error message (localized when `t` is given, English
 * otherwise), or null when the answer is valid.
 */
export function validateAnswer(
  question: Question,
  answer: AnswerValue,
  t?: TranslateFn,
): string | null {
  if (question.required && isEmpty(answer)) {
    return t ? t("validation.required") : "This question is required.";
  }

  // No further checks needed for an empty optional answer.
  if (isEmpty(answer)) return null;

  for (const rule of getValidationRules(question)) {
    const error = checkRule(rule, answer, t);
    if (error) return error;
  }
  return null;
}

function checkRule(
  rule: ValidationRule,
  answer: AnswerValue,
  t: TranslateFn | undefined,
): string | null {
  switch (rule.type) {
    case "minLength":
      if (typeof answer === "string" && rule.value != null && answer.length < rule.value) {
        return ruleMessage(rule, t, "validation.minLength",
          `Must be at least ${rule.value} characters.`, { count: rule.value });
      }
      return null;
    case "maxLength":
      if (typeof answer === "string" && rule.value != null && answer.length > rule.value) {
        return ruleMessage(rule, t, "validation.maxLength",
          `Must be at most ${rule.value} characters.`, { count: rule.value });
      }
      return null;
    case "pattern":
      if (typeof answer === "string" && rule.pattern) {
        try {
          if (!new RegExp(rule.pattern).test(answer)) {
            return ruleMessage(rule, t, "validation.pattern", "Invalid format.");
          }
        } catch {
          // An invalid regex configured in the builder should not block answers.
          return null;
        }
      }
      return null;
    case "minSelected":
      if (Array.isArray(answer) && rule.value != null && answer.length < rule.value) {
        return ruleMessage(rule, t, "validation.minSelected",
          `Select at least ${rule.value} option(s).`, { count: rule.value });
      }
      return null;
    case "maxSelected":
      if (Array.isArray(answer) && rule.value != null && answer.length > rule.value) {
        return ruleMessage(rule, t, "validation.maxSelected",
          `Select at most ${rule.value} option(s).`, { count: rule.value });
      }
      return null;
    default:
      return null;
  }
}
