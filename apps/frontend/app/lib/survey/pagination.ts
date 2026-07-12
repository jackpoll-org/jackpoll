// ── Multi-page pagination (issue #28) ───────────────────────────────
//
// Splits a survey's currently-visible questions into ordered pages based on
// its sections. Flat surveys (no sections) collapse to a single page, so
// existing behaviour is unchanged.

import type { Question, Survey } from "@/app/types/survey";
import { isQuestionVisible, isSectionVisible } from "./logic";
import type { AnswerValue } from "./validation";

export interface SurveyPage {
  /** Owning section id, or null for the implicit ungrouped page. */
  sectionId: string | null;
  title?: string;
  description?: string;
  questions: Question[];
}

/**
 * Build the ordered, currently-visible pages for a survey. Conditional logic
 * (#6) hides questions and whole sections; empty pages are dropped.
 */
export function buildPages(
  survey: Survey,
  answers: Record<string, AnswerValue>,
): SurveyPage[] {
  const visible = survey.questions.filter((q) => isQuestionVisible(q, answers));

  // Conversational layout (#82): one question per page, sections ignored.
  if (survey.settings.conversational) {
    return visible.map((q) => ({
      sectionId: q.sectionId ?? null,
      questions: [q],
    }));
  }

  const sections = (survey.sections ?? []).toSorted((a, b) => a.order - b.order);

  // Page 1 (the implicit ungrouped bucket) can carry its own heading (#94).
  const firstPageTitle = survey.settings.firstPageTitle || undefined;
  const firstPageDescription = survey.settings.firstPageDescription || undefined;

  if (sections.length === 0) {
    return [
      {
        sectionId: null,
        title: firstPageTitle,
        description: firstPageDescription,
        questions: visible,
      },
    ];
  }

  const pages: SurveyPage[] = [];

  const ungrouped = visible.filter((q) => !q.sectionId);
  if (ungrouped.length > 0) {
    pages.push({
      sectionId: null,
      title: firstPageTitle,
      description: firstPageDescription,
      questions: ungrouped,
    });
  }

  for (const section of sections) {
    if (!isSectionVisible(section, answers)) continue;
    const questions = visible.filter((q) => q.sectionId === section.id);
    if (questions.length === 0) continue;
    pages.push({
      sectionId: section.id,
      title: section.title,
      description: section.description,
      questions,
    });
  }

  return pages;
}
