"use client";

import { cn } from "@/lib/utils";
import type { Option } from "@/app/types/survey";
import { ratingGridConfig } from "../editors/rating-grid-editor";
import type { QuestionPreviewProps } from "../types";
import { useTranslation } from "@/app/i18n/context";

type GridRatings = Record<string, number>;

/** Preview / answer renderer for rating-grid questions (rows × shared scale). */
export function RatingGridPreview({
  question,
  value,
  onChange,
  disabled,
}: QuestionPreviewProps) {
  const { t } = useTranslation();
  const rows: Option[] = question.rows ?? [];
  const cfg = ratingGridConfig(question.settings);
  const interactive = !!onChange && !disabled;
  const scale = Array.from({ length: cfg.scaleMax }, (_, i) => i + 1);

  if (rows.length === 0) {
    return (
      <p className="text-sm italic text-muted-foreground">{t("qprev.grid.addRow")}</p>
    );
  }

  const answer: GridRatings =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as GridRatings)
      : {};

  const set = (rowId: string, n: number) => {
    if (interactive) onChange?.({ ...answer, [rowId]: n });
  };

  return (
    <div className="grid gap-3">
      {(cfg.minLabel || cfg.maxLabel) && (
        <div className="flex justify-between pl-[40%] text-xs text-muted-foreground">
          <span>{cfg.minLabel}</span>
          <span>{cfg.maxLabel}</span>
        </div>
      )}
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-3">
          <span className="w-[40%] text-sm">{row.label}</span>
          <div
            className="flex flex-1 flex-wrap gap-1.5"
            role="radiogroup"
            aria-label={row.label}
          >
            {scale.map((n) => {
              const selected = answer[row.id] === n;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={!interactive}
                  aria-label={`${row.label}: ${n}`}
                  aria-pressed={selected}
                  onClick={() => set(row.id, n)}
                  className={cn(
                    "h-9 min-w-9 rounded-md border px-2 text-sm font-medium tabular-nums transition-colors",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background hover:bg-accent",
                    interactive && "cursor-pointer",
                  )}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
