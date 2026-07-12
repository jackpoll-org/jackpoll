import { newId } from "@/app/components/question-types/helpers";
import { getLogicRule, withLogicRule } from "@/app/lib/survey/logic";
import type { Option, Question } from "@/app/types/survey";

/**
 * Deep-copy a survey's questions with fresh ids and sequential order (issue #27).
 * References to other ids are remapped so the copy is fully independent:
 * - choice/grid option ids,
 * - quiz correct-answer option ids,
 * - conditional-logic conditions (referenced questionId and option value).
 */
export function cloneQuestions(questions: Question[]): Question[] {
  const questionIdMap = new Map<string, string>();
  const optionIdMap = new Map<string, string>();

  const cloneOptions = (list: Option[] | null | undefined): Option[] | null => {
    if (!list || list.length === 0) return null;
    return list.map((o) => {
      const id = newId();
      optionIdMap.set(o.id, id);
      return { id, label: o.label };
    });
  };

  // Pass 1: new ids for questions and their options/rows/columns.
  const cloned = questions.map((q, index) => {
    const id = newId();
    questionIdMap.set(q.id, id);
    return {
      ...q,
      id,
      order: index,
      options: cloneOptions(q.options),
      rows: cloneOptions(q.rows),
      columns: cloneOptions(q.columns),
    };
  });

  // Pass 2: remap correct answers and conditional-logic references.
  return cloned.map((q) => {
    const correctAnswers =
      q.correctAnswers?.map((ca) => optionIdMap.get(ca) ?? ca) ?? null;

    let settings = q.settings;
    const rule = getLogicRule(q);
    if (rule) {
      const conditions = rule.conditions.map((c) => ({
        ...c,
        questionId: questionIdMap.get(c.questionId) ?? c.questionId,
        value: c.value != null ? optionIdMap.get(c.value) ?? c.value : c.value,
      }));
      settings = withLogicRule(q, { ...rule, conditions });
    }

    return { ...q, correctAnswers, settings };
  });
}
