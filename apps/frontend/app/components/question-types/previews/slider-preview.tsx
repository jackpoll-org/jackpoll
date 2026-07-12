"use client";

import { useEffect } from "react";
import { Slider } from "@/app/components/ui/slider";
import { sliderConfig } from "../editors/slider-editor";
import type { QuestionPreviewProps } from "../types";

/** Preview / answer renderer for slider questions (numeric range). */
export function SliderPreview({
  question,
  value,
  onChange,
  disabled,
}: QuestionPreviewProps) {
  const cfg = sliderConfig(question.settings);
  const interactive = !!onChange;
  const current = typeof value === "number" ? value : cfg.min;

  // A slider always shows a value, so record the default once — this satisfies
  // a required question and keeps the stored answer in sync with what's shown.
  useEffect(() => {
    if (interactive && typeof value !== "number") onChange(cfg.min);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{cfg.minLabel}</span>
        <span className="font-medium tabular-nums">{current}</span>
        <span className="text-muted-foreground">{cfg.maxLabel}</span>
      </div>
      <Slider
        min={cfg.min}
        max={cfg.max}
        step={cfg.step}
        value={[current]}
        disabled={disabled ?? !interactive}
        onValueChange={interactive ? (v) => onChange(v[0]) : undefined}
        aria-label={question.title || "Slider"}
      />
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{cfg.min}</span>
        <span>{cfg.max}</span>
      </div>
    </div>
  );
}
