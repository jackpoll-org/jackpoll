"use client";

import type { Option } from "@/app/types/survey";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import type { QuestionEditorProps } from "../types";
import { OptionListEditor } from "./option-list-editor";
import { useTranslation } from "@/app/i18n/context";

/** Read the rating-grid config from a question's settings, with defaults. */
export function ratingGridConfig(settings: Record<string, unknown> | null | undefined) {
  const scaleMax = Number(settings?.scaleMax) >= 2 ? Number(settings?.scaleMax) : 5;
  return {
    scaleMax,
    minLabel: typeof settings?.minLabel === "string" ? settings.minLabel : "",
    maxLabel: typeof settings?.maxLabel === "string" ? settings.maxLabel : "",
  };
}

/** Editor for rating-grid questions: rows + a shared numeric scale + anchors. */
export function RatingGridEditor({ question, onChange }: QuestionEditorProps) {
  const { t } = useTranslation();
  const rows: Option[] = question.rows ?? [];
  const cfg = ratingGridConfig(question.settings);

  function patch(p: Record<string, unknown>) {
    onChange({ settings: { ...(question.settings ?? {}), ...p } });
  }

  return (
    <div className="grid gap-4">
      <OptionListEditor
        label={t("qedit.rows")}
        options={rows}
        onChange={(next) => onChange({ rows: next })}
        addLabel={t("qedit.addRow")}
        itemNoun={t("qedit.noun.row")}
      />

      <div className="grid gap-3">
        <div className="grid w-32 gap-1">
          <Label htmlFor={`${question.id}-scale`} className="text-xs">
            {t("qedit.grid.scale")}
          </Label>
          <Input
            id={`${question.id}-scale`}
            type="number"
            min={2}
            max={10}
            value={cfg.scaleMax}
            onChange={(e) =>
              patch({ scaleMax: Math.min(10, Math.max(2, Number(e.target.value) || 5)) })
            }
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1">
            <Label htmlFor={`${question.id}-minlabel`} className="text-xs">
              {t("qedit.leftLabel")}
            </Label>
            <Input
              id={`${question.id}-minlabel`}
              value={cfg.minLabel}
              placeholder={t("qedit.egPoor")}
              onChange={(e) => patch({ minLabel: e.target.value })}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor={`${question.id}-maxlabel`} className="text-xs">
              {t("qedit.rightLabel")}
            </Label>
            <Input
              id={`${question.id}-maxlabel`}
              value={cfg.maxLabel}
              placeholder={t("qedit.egExcellent")}
              onChange={(e) => patch({ maxLabel: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
