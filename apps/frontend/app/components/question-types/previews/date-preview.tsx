"use client";

import { Input } from "@/app/components/ui/input";
import { dateConfig } from "../editors/date-editor";
import type { QuestionPreviewProps } from "../types";
import { useTranslation } from "@/app/i18n/context";

/** Preview / answer renderer for date/time questions (native picker).
 *  "datetime" mode renders separate date and time inputs, each bound by its
 *  own independent min/max, and joins them into one "YYYY-MM-DDTHH:mm" answer. */
export function DatePreview({
  question,
  value,
  onChange,
  disabled,
}: QuestionPreviewProps) {
  const { locale } = useTranslation();
  const cfg = dateConfig(question.settings);
  const interactive = !!onChange && !disabled;
  const current = typeof value === "string" ? value : "";
  // Force dd.mm.yyyy / 24h formatting for German rather than the browser/OS
  // locale, independent of the min/max values themselves (#).
  const inputLang = locale === "de" ? "de-DE" : "en-US";

  if (cfg.mode === "datetime") {
    const [datePart = "", timePart = ""] = current.split("T");
    function setPart(nextDate: string, nextTime: string) {
      onChange?.(nextDate || nextTime ? `${nextDate}T${nextTime}` : "");
    }
    return (
      <div className="flex flex-wrap gap-2">
        <Input
          type="date"
          lang={inputLang}
          className="w-fit"
          value={datePart}
          min={cfg.dateMin || undefined}
          max={cfg.dateMax || undefined}
          disabled={!interactive}
          onChange={interactive ? (e) => setPart(e.target.value, timePart) : undefined}
          aria-label={question.title || "Date"}
        />
        <Input
          type="time"
          lang={inputLang}
          className="w-fit"
          value={timePart}
          min={cfg.timeMin || undefined}
          max={cfg.timeMax || undefined}
          disabled={!interactive}
          onChange={interactive ? (e) => setPart(datePart, e.target.value) : undefined}
          aria-label={question.title || "Time"}
        />
      </div>
    );
  }

  const isTime = cfg.mode === "time";
  return (
    <Input
      type={isTime ? "time" : "date"}
      lang={inputLang}
      className="w-fit"
      value={current}
      min={(isTime ? cfg.timeMin : cfg.dateMin) || undefined}
      max={(isTime ? cfg.timeMax : cfg.dateMax) || undefined}
      disabled={!interactive}
      onChange={interactive ? (e) => onChange?.(e.target.value) : undefined}
      aria-label={question.title || "Date"}
    />
  );
}
