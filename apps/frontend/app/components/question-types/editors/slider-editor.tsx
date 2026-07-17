"use client";

import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import type { QuestionEditorProps } from "../types";
import { useTranslation } from "@/app/i18n/context";

/** Read the slider config from a question's settings, with sensible defaults. */
export function sliderConfig(settings: Record<string, unknown> | null | undefined) {
  return {
    min: Number(settings?.min ?? 0),
    max: Number(settings?.max ?? 10),
    step: Number(settings?.step) > 0 ? Number(settings?.step) : 1,
    minLabel: typeof settings?.minLabel === "string" ? settings.minLabel : "",
    maxLabel: typeof settings?.maxLabel === "string" ? settings.maxLabel : "",
  };
}

/** Editor for slider questions: numeric range, step and optional end labels. */
export function SliderEditor({ question, onChange }: QuestionEditorProps) {
  const { t } = useTranslation();
  const cfg = sliderConfig(question.settings);

  function patch(p: Record<string, unknown>) {
    onChange({ settings: { ...(question.settings ?? {}), ...p } });
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        {t("qedit.slider.help")}
      </p>

      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-1">
          <Label htmlFor={`${question.id}-min`} className="text-xs">{t("qedit.slider.min")}</Label>
          <Input
            id={`${question.id}-min`}
            type="number"
            value={cfg.min}
            onChange={(e) => patch({ min: Number(e.target.value) })}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`${question.id}-max`} className="text-xs">{t("qedit.slider.max")}</Label>
          <Input
            id={`${question.id}-max`}
            type="number"
            value={cfg.max}
            onChange={(e) => patch({ max: Number(e.target.value) })}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`${question.id}-step`} className="text-xs">{t("qedit.slider.step")}</Label>
          <Input
            id={`${question.id}-step`}
            type="number"
            min={0}
            step="any"
            value={cfg.step}
            onChange={(e) => {
              const next = Number(e.target.value);
              patch({ step: next > 0 ? next : 1 });
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1">
          <Label htmlFor={`${question.id}-minlabel`} className="text-xs">
            {t("qedit.leftLabel")}
          </Label>
          <Input
            id={`${question.id}-minlabel`}
            value={cfg.minLabel}
            placeholder={t("qedit.egNotLikely")}
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
            placeholder={t("qedit.egVeryLikely")}
            onChange={(e) => patch({ maxLabel: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
