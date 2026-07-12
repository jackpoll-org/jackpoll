"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { ratingConfig, ratingRange } from "../editors/rating-editor";
import type { QuestionPreviewProps } from "../types";

const EMOJIS = ["😡", "😕", "😐", "🙂", "😍"];

/** Preview / answer renderer for rating questions (stars / emoji / nps / likert). */
export function RatingPreview({
  question,
  value,
  onChange,
  disabled,
}: QuestionPreviewProps) {
  const cfg = ratingConfig(question.settings);
  const interactive = !!onChange && !disabled;
  const current = typeof value === "number" ? value : null;
  const { min, max } = ratingRange(cfg.variant, cfg.max);

  const select = (v: number) => {
    if (interactive) onChange?.(v);
  };

  if (cfg.variant === "stars") {
    return (
      <div className="flex items-center gap-1" role="radiogroup" aria-label={question.title}>
        {Array.from({ length: cfg.max }, (_, i) => i + 1).map((n) => {
          const filled = current != null && n <= current;
          return (
            <button
              key={n}
              type="button"
              disabled={!interactive}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              aria-pressed={current === n}
              onClick={() => select(n)}
              className={cn(
                "rounded p-0.5 transition-transform",
                interactive && "hover:scale-110 cursor-pointer",
              )}
            >
              <Star
                className={cn(
                  "size-7",
                  filled ? "fill-primary text-primary" : "text-muted-foreground/40",
                )}
              />
            </button>
          );
        })}
      </div>
    );
  }

  if (cfg.variant === "emoji") {
    return (
      <div className="flex items-center gap-2" role="radiogroup" aria-label={question.title}>
        {EMOJIS.map((emoji, i) => {
          const n = i + 1;
          return (
            <button
              key={n}
              type="button"
              disabled={!interactive}
              aria-label={`Rating ${n}`}
              aria-pressed={current === n}
              onClick={() => select(n)}
              className={cn(
                "rounded-full text-2xl leading-none transition-all p-1.5",
                current === n
                  ? "scale-110 bg-accent ring-2 ring-primary"
                  : "opacity-60 hover:opacity-100",
                interactive && "cursor-pointer",
              )}
            >
              {emoji}
            </button>
          );
        })}
      </div>
    );
  }

  // nps + likert: a row of numbered buttons with optional end anchors.
  const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={question.title}>
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            disabled={!interactive}
            aria-label={`${n}`}
            aria-pressed={current === n}
            onClick={() => select(n)}
            className={cn(
              "h-9 min-w-9 rounded-md border px-2 text-sm font-medium tabular-nums transition-colors",
              current === n
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background hover:bg-accent",
              interactive && "cursor-pointer",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      {(cfg.minLabel || cfg.maxLabel) && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{cfg.minLabel}</span>
          <span>{cfg.maxLabel}</span>
        </div>
      )}
    </div>
  );
}
