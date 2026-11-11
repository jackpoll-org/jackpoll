import { newId } from "@/app/components/question-types/helpers";
import { getLogicRule, withLogicRule } from "@/app/lib/survey/logic";
import type { LogicRule, Option, Question, Section } from "@/app/types/survey";

/**
 * Deep-copy a survey's questions with fresh ids and sequential order (issue #27).
 * References to other ids are remapped so the copy is fully independent:
 * - choice/grid option ids,
 * - quiz correct-answer option ids,
 * - conditional-logic conditions of questions and sections (referenced
 *   questionId and option value).
 * Sections keep their ids, so each question stays on its page.
 */
export function cloneContent(
  questions: Question[],
  sections: Section[] = [],
): { questions: Question[]; sections: Section[] } {
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

  const remapRule = (rule: LogicRule): LogicRule => ({
    ...rule,
    conditions: rule.conditions.map((c) => ({
      ...c,
      questionId: questionIdMap.get(c.questionId) ?? c.questionId,
      value: c.value != null ? optionIdMap.get(c.value) ?? c.value : c.value,
    })),
  });

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

  return {
    questions: cloned.map((q) => {
      const correctAnswers =
        q.correctAnswers?.map((ca) => optionIdMap.get(ca) ?? ca) ?? null;
      const rule = getLogicRule(q);
      const settings = rule ? withLogicRule(q, remapRule(rule)) : q.settings;
      return { ...q, correctAnswers, settings };
    }),
    sections: sections.map((s) => (s.visibleIf ? { ...s, visibleIf: remapRule(s.visibleIf) } : s)),
  };
}
