"use client";

import type { Option } from "@/app/types/survey";
import type { QuestionEditorProps } from "../types";
import { OptionListEditor } from "./option-list-editor";
import { useTranslation } from "@/app/i18n/context";

/** Editor for multiple-choice, checkboxes and dropdown — a single list of options. */
export function ChoiceEditor({ question, onChange }: QuestionEditorProps) {
  const { t } = useTranslation();
  const options: Option[] = question.options ?? [];
  // Per-option quotas apply to single-select choices only (issue #38).
  const showCapacity =
    question.type === "multiple-choice" || question.type === "dropdown";

  return (
    <OptionListEditor
      label={showCapacity ? t("qedit.choice.optionsLimit") : t("qedit.choice.options")}
      options={options}
      onChange={(next) => onChange({ options: next })}
      addLabel={t("qedit.addOption")}
      itemNoun={t("qedit.noun.option")}
      showCapacity={showCapacity}
    />
  );
}
