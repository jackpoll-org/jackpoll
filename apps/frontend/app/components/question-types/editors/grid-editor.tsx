"use client";

import type { Option } from "@/app/types/survey";
import type { QuestionEditorProps } from "../types";
import { OptionListEditor } from "./option-list-editor";
import { useTranslation } from "@/app/i18n/context";

/** Editor for grid question types — separate row and column lists. */
export function GridEditor({ question, onChange }: QuestionEditorProps) {
  const { t } = useTranslation();
  const rows: Option[] = question.rows ?? [];
  const columns: Option[] = question.columns ?? [];

  return (
    <div className="grid gap-4">
      <OptionListEditor
        label={t("qedit.rows")}
        options={rows}
        onChange={(next) => onChange({ rows: next })}
        addLabel={t("qedit.addRow")}
        itemNoun={t("qedit.noun.row")}
      />
      <OptionListEditor
        label={t("qedit.columns")}
        options={columns}
        onChange={(next) => onChange({ columns: next })}
        addLabel={t("qedit.addColumn")}
        itemNoun={t("qedit.noun.column")}
      />
    </div>
  );
}
