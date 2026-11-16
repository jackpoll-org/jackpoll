// ── Multi-page pagination (issue #28) ───────────────────────────────
//
// Splits a survey's currently-visible questions into ordered pages based on
// its sections. Flat surveys (no sections) collapse to a single page, so
// existing behaviour is unchanged.

import type { Question, Section, Survey } from "@/app/types/survey";
import { isAnswerable } from "./content-block";
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
  return layoutPages(
    survey,
    (q) => isQuestionVisible(q, answers),
    (s) => isSectionVisible(s, answers),
  );
}

export function buildAllPages(survey: Survey): SurveyPage[] {
  const pages = layoutAllPages(survey);
  const placed = new Set(pages.flatMap((page) => page.questions.map((q) => q.id)));
  const unplaced = survey.questions.filter((q) => !placed.has(q.id));
  return unplaced.length > 0 ? [...pages, { sectionId: null, questions: unplaced }] : pages;
}

// Mirrored by SurveyPages.java; both must pass __tests__/fixtures/page-order.json.
export function questionsInPageOrder(survey: Survey): Question[] {
  return buildAllPages(survey).flatMap((page) => page.questions);
}

export function questionsOnPlayerPages(survey: Survey): Question[] {
  return layoutAllPages(survey).flatMap((page) => page.questions);
}

export function getPrecedingQuestions(survey: Survey, questionId: string): Question[] {
  const ordered = questionsOnPlayerPages(survey);
  const index = ordered.findIndex((q) => q.id === questionId);
  return index <= 0 ? [] : ordered.slice(0, index).filter((q) => isAnswerable(q.type));
}

function layoutAllPages(survey: Survey): SurveyPage[] {
  return layoutPages(survey, () => true, () => true);
}

function sectionKey(id: string | null | undefined): string | null {
  return id == null || /^[ \t\n\r\f\v]*$/.test(id) ? null : id;
}

function layoutPages(
  survey: Survey,
  isVisible: (question: Question) => boolean,
  isPageVisible: (section: Section) => boolean,
): SurveyPage[] {
  const visible = survey.questions.filter(isVisible);

  // Conversational layout (#82): one question per page, sections ignored.
  if (survey.settings.conversational) {
    return visible.map((q) => ({
      sectionId: sectionKey(q.sectionId),
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

  const ungrouped: Question[] = [];
  const bySection = new Map<string, Question[]>();
  for (const q of visible) {
    const key = sectionKey(q.sectionId);
    if (key === null) ungrouped.push(q);
    else if (bySection.has(key)) bySection.get(key)!.push(q);
    else bySection.set(key, [q]);
  }
  if (ungrouped.length > 0) {
    pages.push({
      sectionId: null,
      title: firstPageTitle,
      description: firstPageDescription,
      questions: ungrouped,
    });
  }

  for (const section of sections) {
    if (sectionKey(section.id) === null || !isPageVisible(section)) continue;
    const questions = bySection.get(section.id);
    if (!questions) continue;
    pages.push({
      sectionId: section.id,
      title: section.title,
      description: section.description,
      questions,
    });
  }

  return pages;
}
