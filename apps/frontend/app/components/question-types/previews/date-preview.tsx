"use client";

import { Input } from "@/app/components/ui/input";
import { dateConfig, dateInputType } from "../editors/date-editor";
import type { QuestionPreviewProps } from "../types";

/** Preview / answer renderer for date/time questions (native picker). */
export function DatePreview({
  question,
  value,
  onChange,
  disabled,
}: QuestionPreviewProps) {
  const cfg = dateConfig(question.settings);
  const interactive = !!onChange && !disabled;
  const current = typeof value === "string" ? value : "";

  return (
    <Input
      type={dateInputType(cfg.mode)}
      className="w-fit"
      value={current}
      min={cfg.min || undefined}
      max={cfg.max || undefined}
      disabled={!interactive}
      onChange={interactive ? (e) => onChange?.(e.target.value) : undefined}
      aria-label={question.title || "Date"}
    />
  );
}
