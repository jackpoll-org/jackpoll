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

export type RatingVariant = "stars" | "emoji" | "nps" | "likert";

const VARIANTS: RatingVariant[] = ["stars", "emoji", "nps", "likert"];

const VARIANT_LABEL_KEY: Record<RatingVariant, TranslationKey> = {
  stars: "qedit.rating.stars",
  emoji: "qedit.rating.emoji",
  nps: "qedit.rating.nps",
  likert: "qedit.rating.likert",
};

/** Read the rating config from a question's settings, with sensible defaults. */
export function ratingConfig(settings: Record<string, unknown> | null | undefined) {
  const raw = settings?.variant;
  const variant: RatingVariant = VARIANTS.includes(raw as RatingVariant)
    ? (raw as RatingVariant)
    : "stars";
  const max = Number(settings?.max) >= 2 ? Number(settings?.max) : 5;
  return {
    variant,
    max,
    minLabel: typeof settings?.minLabel === "string" ? settings.minLabel : "",
    maxLabel: typeof settings?.maxLabel === "string" ? settings.maxLabel : "",
  };
}

/** The selectable numeric range for a rating variant. */
export function ratingRange(
  variant: RatingVariant,
  max: number,
): { min: number; max: number } {
  switch (variant) {
    case "nps":
      return { min: 0, max: 10 };
    case "emoji":
    case "likert":
      return { min: 1, max: 5 };
    default:
      return { min: 1, max }; // stars
  }
}

/** Editor for rating questions: variant + (stars count | end labels). */
export function RatingEditor({ question, onChange }: QuestionEditorProps) {
  const { t } = useTranslation();
  const cfg = ratingConfig(question.settings);

  function patch(p: Record<string, unknown>) {
    onChange({ settings: { ...(question.settings ?? {}), ...p } });
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        {t("qedit.rating.help")}
      </p>

      <div className="grid gap-1">
        <Label className="text-xs">{t("qedit.rating.style")}</Label>
        <Select
          value={cfg.variant}
          onValueChange={(v) => patch({ variant: v as RatingVariant })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VARIANTS.map((v) => (
              <SelectItem key={v} value={v}>
                {t(VARIANT_LABEL_KEY[v])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {cfg.variant === "stars" && (
        <div className="grid w-28 gap-1">
          <Label htmlFor={`${question.id}-max`} className="text-xs">
            {t("qedit.rating.numStars")}
          </Label>
          <Input
            id={`${question.id}-max`}
            type="number"
            min={2}
            max={10}
            value={cfg.max}
            onChange={(e) =>
              patch({ max: Math.min(10, Math.max(2, Number(e.target.value) || 5)) })
            }
          />
        </div>
      )}

      {(cfg.variant === "nps" || cfg.variant === "likert") && (
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
      )}
    </div>
  );
}
