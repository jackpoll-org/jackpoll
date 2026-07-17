import type {
  LogicCondition,
  LogicRule,
  Question,
  Section,
  Survey,
} from "@/app/types/survey";
import type { AnswerValue } from "./validation";

/**
 * Flatten a survey's questions into the order a respondent actually answers
 * them: the ungrouped first page, then each section by its `order`, and within
 * every page the questions in their stored array order. This mirrors how
 * `buildPages` lays out the survey, so it is the correct basis for "which
 * questions come before this one".
 */
export function orderedQuestions(survey: Survey): Question[] {
  const sections = (survey.sections ?? []).toSorted((a, b) => a.order - b.order);
  const inSection = (id: string | null) =>
    survey.questions.filter((q) => (q.sectionId ?? null) === id);
  return [inSection(null), ...sections.map((s) => inSection(s.id))].flat();
}

/**
 * Questions that precede `questionId` in answer-flow order — the only ones a
 * conditional rule may reference. Spans earlier pages, not just the current
 * one, and excludes the question itself and anything after it.
 */
export function getPrecedingQuestions(
  survey: Survey,
  questionId: string,
): Question[] {
  const ordered = orderedQuestions(survey);
  const index = ordered.findIndex((q) => q.id === questionId);
  return index <= 0 ? [] : ordered.slice(0, index);
}

/** Read the conditional-logic rule stored in a question's settings JSON. */
export function getLogicRule(question: Question): LogicRule | null {
  const raw = question.settings?.logic;
  if (raw && typeof raw === "object" && Array.isArray((raw as LogicRule).conditions)) {
    return raw as LogicRule;
  }
  return null;
}

/** Produce a settings patch that stores (or clears) the logic rule. */
export function withLogicRule(
  question: Question,
  rule: LogicRule | null,
): Record<string, unknown> {
  const settings = { ...(question.settings ?? {}) };
  if (rule && rule.conditions.length > 0) {
    settings.logic = rule;
  } else {
    delete settings.logic;
  }
  return settings;
}

export function hasLogic(question: Question): boolean {
  const rule = getLogicRule(question);
  return !!rule && rule.conditions.length > 0;
}

function isEmpty(value: AnswerValue): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return Object.keys(value).length === 0;
}

function asText(value: AnswerValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((v) => String(v)).join(",");
  return JSON.stringify(value);
}

function asArray(value: AnswerValue): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === "string") return value === "" ? [] : [value];
  return [];
}

export function evaluateCondition(
  condition: LogicCondition,
  answers: Record<string, AnswerValue>,
): boolean {
  const answer = answers[condition.questionId];
  const target = condition.value ?? "";

  switch (condition.operator) {
    case "empty":
      return isEmpty(answer);
    case "notEmpty":
      return !isEmpty(answer);
    case "equals":
      return asText(answer) === target || asArray(answer).join(",") === target;
    case "notEquals":
      return !(asText(answer) === target || asArray(answer).join(",") === target);
    case "contains":
      return Array.isArray(answer)
        ? asArray(answer).includes(target)
        : asText(answer).includes(target);
    case "notContains":
      return Array.isArray(answer)
        ? !asArray(answer).includes(target)
        : !asText(answer).includes(target);
    case "greaterThan": {
      const a = Number(asText(answer));
      const b = Number(target);
      return !Number.isNaN(a) && !Number.isNaN(b) && a > b;
    }
    case "lessThan": {
      const a = Number(asText(answer));
      const b = Number(target);
      return !Number.isNaN(a) && !Number.isNaN(b) && a < b;
    }
    default:
      return true;
  }
}

/**
 * Whether a question should be visible given the current answers. Questions
 * without a rule are always visible. Conditions reference earlier questions,
 * so evaluation is acyclic by construction.
 */
export function isQuestionVisible(
  question: Question,
  answers: Record<string, AnswerValue>,
): boolean {
  const rule = getLogicRule(question);
  if (!rule || rule.conditions.length === 0) return true;

  const results = rule.conditions.map((c) => evaluateCondition(c, answers));
  return rule.match === "all" ? results.every(Boolean) : results.some(Boolean);
}

/**
 * Whether a section should be shown given the current answers (issue #28).
 * Extends the question-level branching of #6 to whole pages.
 */
export function isSectionVisible(
  section: Section,
  answers: Record<string, AnswerValue>,
): boolean {
  const rule = section.visibleIf;
  if (!rule || rule.conditions.length === 0) return true;
  const results = rule.conditions.map((c) => evaluateCondition(c, answers));
  return rule.match === "all" ? results.every(Boolean) : results.some(Boolean);
}
