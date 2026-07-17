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

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Split a legacy combined `min`/`max` value (from before date/time bounds
 * were split into independent pairs) into its date and time components, so
 * an existing question's bound isn't silently dropped on first edit.
 */
function splitLegacy(value: string, mode: DateMode): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  if (mode === "date") return { date: value, time: "" };
  if (mode === "time") return { date: "", time: value };
  const [datePart = "", timePart = ""] = value.split("T");
  return { date: datePart, time: timePart };
}

/** Read the date config from a question's settings, with sensible defaults.
 *  Date min/max and time min/max are independent (#): a question can bound
 *  the calendar range and the time-of-day range separately. Falls back to the
 *  older combined `min`/`max` fields for questions created before the split. */
export function dateConfig(settings: Record<string, unknown> | null | undefined) {
  const raw = settings?.mode;
  const mode: DateMode = MODES.includes(raw as DateMode)
    ? (raw as DateMode)
    : "date";
  const legacyMin = splitLegacy(str(settings?.min), mode);
  const legacyMax = splitLegacy(str(settings?.max), mode);
  return {
    mode,
    dateMin: settings?.dateMin != null ? str(settings.dateMin) : legacyMin.date,
    dateMax: settings?.dateMax != null ? str(settings.dateMax) : legacyMax.date,
    timeMin: settings?.timeMin != null ? str(settings.timeMin) : legacyMin.time,
    timeMax: settings?.timeMax != null ? str(settings.timeMax) : legacyMax.time,
  };
}

/** Editor for date/time questions: mode + independent date/time min-max ranges. */
export function DateEditor({ question, onChange }: QuestionEditorProps) {
  const { t, locale } = useTranslation();
  const cfg = dateConfig(question.settings);
  // Force the native picker's date/time format (dd.mm.yyyy, 24h) to match the
  // app's locale rather than the browser/OS locale (#).
  const inputLang = locale === "de" ? "de-DE" : "en-US";

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

      {(cfg.mode === "date" || cfg.mode === "datetime") && (
        <div className="grid gap-1">
          <Label className="text-xs">{t("qedit.date.dateRange")}</Label>
          <div className="grid grid-cols-2 gap-3">
            <Input
              id={`${question.id}-date-min`}
              type="date"
              lang={inputLang}
              aria-label={t("qedit.date.earliest")}
              value={cfg.dateMin}
              onChange={(e) => patch({ dateMin: e.target.value })}
            />
            <Input
              id={`${question.id}-date-max`}
              type="date"
              lang={inputLang}
              aria-label={t("qedit.date.latest")}
              value={cfg.dateMax}
              onChange={(e) => patch({ dateMax: e.target.value })}
            />
          </div>
        </div>
      )}

      {(cfg.mode === "time" || cfg.mode === "datetime") && (
        <div className="grid gap-1">
          <Label className="text-xs">{t("qedit.date.timeRange")}</Label>
          <div className="grid grid-cols-2 gap-3">
            <Input
              id={`${question.id}-time-min`}
              type="time"
              lang={inputLang}
              aria-label={t("qedit.date.earliest")}
              value={cfg.timeMin}
              onChange={(e) => patch({ timeMin: e.target.value })}
            />
            <Input
              id={`${question.id}-time-max`}
              type="time"
              lang={inputLang}
              aria-label={t("qedit.date.latest")}
              value={cfg.timeMax}
              onChange={(e) => patch({ timeMax: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
