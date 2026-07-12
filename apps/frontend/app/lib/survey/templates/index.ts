import { newId } from "@/app/components/question-types/helpers";
import type { Option, Question } from "@/app/types/survey";
import { CURATED_TEMPLATES } from "./catalog";
import type { SurveyTemplate } from "./types";

export { CURATED_TEMPLATES };
export type { SurveyTemplate };

function cloneOptions(
  list: Option[] | null | undefined,
  idMap: Map<string, string>,
): Option[] | null {
  if (!list || list.length === 0) return null;
  return list.map((o) => {
    const id = newId();
    idMap.set(o.id, id);
    return { id, label: o.label };
  });
}

/**
 * Deep-copy a template's questions with fresh ids and sequential order.
 * Correct-answer references to option ids are remapped to the new ids.
 */
export function instantiateTemplateQuestions(template: SurveyTemplate): Question[] {
  return template.questions.map((q, index) => {
    const idMap = new Map<string, string>();
    const options = cloneOptions(q.options, idMap);
    const rows = cloneOptions(q.rows, idMap);
    const columns = cloneOptions(q.columns, idMap);
    const correctAnswers =
      q.correctAnswers?.map((ca) => idMap.get(ca) ?? ca) ?? null;

    return {
      ...q,
      id: newId(),
      order: index,
      options,
      rows,
      columns,
      correctAnswers,
    };
  });
}
