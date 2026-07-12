"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import type {
  LogicCondition,
  LogicOperator,
  LogicRule,
  Question,
} from "@/app/types/survey";
import { getLogicRule, withLogicRule } from "@/app/lib/survey/logic";
import { useTranslation } from "@/app/i18n/context";
import type { TranslationKey } from "@/app/i18n/translations";

const OPERATORS: { value: LogicOperator; labelKey: TranslationKey }[] = [
  { value: "equals", labelKey: "builder.logic.op.equals" },
  { value: "notEquals", labelKey: "builder.logic.op.notEquals" },
  { value: "contains", labelKey: "builder.logic.op.contains" },
  { value: "notContains", labelKey: "builder.logic.op.notContains" },
  { value: "empty", labelKey: "builder.logic.op.empty" },
  { value: "notEmpty", labelKey: "builder.logic.op.notEmpty" },
  { value: "greaterThan", labelKey: "builder.logic.op.greaterThan" },
  { value: "lessThan", labelKey: "builder.logic.op.lessThan" },
];

const NO_VALUE: LogicOperator[] = ["empty", "notEmpty"];

interface QuestionLogicEditorProps {
  question: Question;
  precedingQuestions: Question[];
  onChange: (patch: Partial<Question>) => void;
}

export function QuestionLogicEditor({
  question,
  precedingQuestions,
  onChange,
}: QuestionLogicEditorProps) {
  const { t } = useTranslation();
  // Logic needs an earlier question to reference.
  if (precedingQuestions.length === 0) return null;

  const rule = getLogicRule(question);
  const conditions = rule?.conditions ?? [];

  function commit(next: LogicRule | null) {
    onChange({ settings: withLogicRule(question, next) });
  }

  function update(nextConditions: LogicCondition[], match = rule?.match ?? "all") {
    commit(nextConditions.length === 0 ? null : { match, conditions: nextConditions });
  }

  function addCondition() {
    update([
      ...conditions,
      { questionId: precedingQuestions[0].id, operator: "equals", value: "" },
    ]);
  }

  function patchCondition(index: number, patch: Partial<LogicCondition>) {
    update(conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function removeCondition(index: number) {
    update(conditions.filter((_, i) => i !== index));
  }

  function valueInput(condition: LogicCondition, index: number) {
    if (NO_VALUE.includes(condition.operator)) return null;
    const ref = precedingQuestions.find((q) => q.id === condition.questionId);
    const options = ref?.options ?? [];

    if (options.length > 0) {
      return (
        <Select
          value={condition.value || undefined}
          onValueChange={(v) => patchCondition(index, { value: v })}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("builder.logic.valuePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return (
      <Input
        className="w-40"
        placeholder={t("builder.logic.valuePlaceholder")}
        value={condition.value ?? ""}
        onChange={(e) => patchCondition(index, { value: e.target.value })}
      />
    );
  }

  return (
    <div className="grid gap-3 rounded-lg border border-dashed p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{t("builder.logic.showOnlyIf")}</span>
        {conditions.length > 1 && (
          <Select
            value={rule?.match ?? "all"}
            onValueChange={(v) => update(conditions, v as LogicRule["match"])}
          >
            <SelectTrigger className="w-32" aria-label={t("builder.logic.matchMode")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("builder.logic.matchAll")}</SelectItem>
              <SelectItem value="any">{t("builder.logic.matchAny")}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {conditions.map((condition, index) => (
        <div key={`${condition.questionId}-${index}`} className="flex flex-wrap items-center gap-2">
          <Select
            value={condition.questionId}
            onValueChange={(v) => patchCondition(index, { questionId: v })}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {precedingQuestions.map((q) => (
                <SelectItem key={q.id} value={q.id}>
                  {q.title || t("builder.question.untitled")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={condition.operator}
            onValueChange={(v) => patchCondition(index, { operator: v as LogicOperator })}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATORS.map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  {t(op.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {valueInput(condition, index)}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("builder.logic.removeCondition")}
            onClick={() => removeCondition(index)}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}

      <div>
        <Button type="button" variant="outline" size="sm" onClick={addCondition}>
          <Plus className="size-4" />
          {t("builder.logic.addCondition")}
        </Button>
      </div>
    </div>
  );
}
