"use client";

import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import type { QuestionEditorProps } from "../types";
import { useTranslation } from "@/app/i18n/context";
import type { TranslationKey } from "@/app/i18n/translations";

export type DateMode = "date" | "time" | "datetime";

const MODES: DateMode[] = ["date", "time", "datetime"];

const MODE_LABEL_KEY: Record<DateMode, TranslationKey> = {
  date: "qedit.date.date",
  time: "qedit.date.time",
  datetime: "qedit.date.datetime",
};

/** Native input type for a date mode. */
export function dateInputType(mode: DateMode): "date" | "time" | "datetime-local" {
  return mode === "datetime" ? "datetime-local" : mode;
}

/** Read the date config from a question's settings, with sensible defaults. */
export function dateConfig(settings: Record<string, unknown> | null | undefined) {
  const raw = settings?.mode;
  const mode: DateMode = MODES.includes(raw as DateMode)
    ? (raw as DateMode)
    : "date";
  return {
    mode,
    min: typeof settings?.min === "string" ? settings.min : "",
    max: typeof settings?.max === "string" ? settings.max : "",
  };
}

/** Editor for date/time questions: mode + optional min/max range. */
export function DateEditor({ question, onChange }: QuestionEditorProps) {
  const { t } = useTranslation();
  const cfg = dateConfig(question.settings);
  const inputType = dateInputType(cfg.mode);

  function patch(p: Record<string, unknown>) {
    onChange({ settings: { ...(question.settings ?? {}), ...p } });
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <Label className="text-xs">{t("qedit.date.type")}</Label>
        <Select value={cfg.mode} onValueChange={(v) => patch({ mode: v as DateMode })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODES.map((m) => (
              <SelectItem key={m} value={m}>
                {t(MODE_LABEL_KEY[m])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1">
          <Label htmlFor={`${question.id}-min`} className="text-xs">
            {t("qedit.date.earliest")}
          </Label>
          <Input
            id={`${question.id}-min`}
            type={inputType}
            value={cfg.min}
            onChange={(e) => patch({ min: e.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`${question.id}-max`} className="text-xs">
            {t("qedit.date.latest")}
          </Label>
          <Input
            id={`${question.id}-max`}
            type={inputType}
            value={cfg.max}
            onChange={(e) => patch({ max: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
