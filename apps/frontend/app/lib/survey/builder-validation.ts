import type { Question, Survey } from "@/app/types/survey";
import type { TranslateFn } from "@/app/i18n/context";
import { isButtonComplete, safeButtonUrl } from "@/app/lib/survey/completion-buttons";
import { questionsInPageOrder } from "@/app/lib/survey/pagination";

export const MAX_QUESTIONS = 2000;
export const MAX_SECTIONS = 500;

/** A single thing the author must fix before the survey can be saved. */
export interface BuilderSaveIssue {
  /** The question this issue belongs to, or undefined for survey-level issues. */
  questionId?: string;
  /** Localized, human-readable description of what's missing. */
  message: string;
}

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim() === "";
}

/** Labelled options/rows/columns whose labels must not be blank (backend @NotBlank). */
function questionLabels(question: Question): string[] {
  return [
    ...(question.options ?? []),
    ...(question.rows ?? []),
    ...(question.columns ?? []),
  ].map((o) => o.label);
}

/**
 * Validate a survey against the same not-blank rules the backend enforces, so
 * the author gets a clear, localized list of what's missing. A **draft** may be
 * saved incomplete (untitled questions, empty options) — only the survey title
 * is always required; question/option completeness is enforced when
 * `forPublish` is true (the backend mirrors this: blank question titles/options
 * are rejected only on the publish transition). Returns an empty array when the
 * survey is OK to save in the requested mode.
 */
export function validateSurveyForSave(
  survey: Survey,
  t: TranslateFn,
  forPublish: boolean,
): BuilderSaveIssue[] {
  const issues: BuilderSaveIssue[] = [];

  if (isBlank(survey.title)) {
    issues.push({ message: t("builder.validation.surveyTitle") });
  }
  if (survey.questions.length > MAX_QUESTIONS) {
    issues.push({ message: t("builder.validation.tooManyQuestions", { max: String(MAX_QUESTIONS) }) });
  }
  if ((survey.sections?.length ?? 0) > MAX_SECTIONS) {
    issues.push({ message: t("builder.validation.tooManyPages", { max: String(MAX_SECTIONS) }) });
  }

  (survey.settings?.completionButtons ?? []).forEach((button, index) => {
    const n = String(index + 1);
    if (button.action === "url" && !isBlank(button.url) && !safeButtonUrl(button.url)) {
      issues.push({ message: t("builder.validation.buttonUrlInvalid", { n }) });
    } else if (forPublish && button.enabled && !isButtonComplete(button)) {
      issues.push({ message: t("builder.validation.buttonIncomplete", { n }) });
    }
  });

  if (!forPublish) return issues;

  questionsInPageOrder(survey).forEach((question, index) => {
    const n = String(index + 1);
    // A content block's heading is optional (public #7).
    if (question.type !== "content" && isBlank(question.title)) {
      issues.push({
        questionId: question.id,
        message: t("builder.validation.questionTitle", { n }),
      });
    }
    if (questionLabels(question).some(isBlank)) {
      issues.push({
        questionId: question.id,
        message: t("builder.validation.optionLabel", { n }),
      });
    }
  });

  return issues;
}
