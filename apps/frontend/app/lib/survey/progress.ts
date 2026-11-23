import type { Survey } from "@/app/types/survey";
import { isAnswerable } from "./content-block";
import { buildPages, type SurveyPage } from "./pagination";
import { isEmpty, type AnswerValue } from "./validation";

export interface SurveyProgress {
  page: number;
  pageCount: number;
  question: number | null;
  answered: number;
  total: number;
}

export function computeProgress(
  survey: Survey,
  answers: Record<string, AnswerValue>,
  pageIndex: number,
  options: { pages?: SurveyPage[]; sent?: ReadonlySet<string> } = {},
): SurveyProgress {
  const pages = options.pages ?? buildPages(survey, answers);
  const current = Math.min(pageIndex, Math.max(0, pages.length - 1));
  const countable = pages.map((page) => page.questions.filter((q) => isAnswerable(q.type)));
  const total = countable.reduce((sum, questions) => sum + questions.length, 0);
  const before = countable.slice(0, current).reduce((sum, questions) => sum + questions.length, 0);
  return {
    page: current + 1,
    pageCount: pages.length,
    question: countable[current]?.length ? before + 1 : null,
    answered: countable.flat().filter((q) => options.sent?.has(q.id) || !isEmpty(answers[q.id])).length,
    total,
  };
}
