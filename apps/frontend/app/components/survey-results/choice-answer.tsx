"use client";

import { CheckCircle2, Circle, CircleDashed, XCircle } from "lucide-react";
import { useTranslation } from "@/app/i18n/context";
import { cn } from "@/lib/utils";
import type { Question } from "@/app/types/survey";

type OptionStatus = "hit" | "missed" | "wrong" | "neutral" | "selected";

const STATUS_STYLE: Record<OptionStatus, string> = {
  hit: "border-green-600/40 bg-green-500/15 dark:bg-green-500/20",
  missed: "border-amber-500/50 bg-amber-400/20 dark:bg-amber-400/15",
  wrong: "border-destructive/40 bg-destructive/10",
  neutral: "border-border bg-background",
  selected: "border-primary/40 bg-primary/10",
};

const STATUS_ICON: Record<OptionStatus, typeof Circle> = {
  hit: CheckCircle2,
  missed: CircleDashed,
  wrong: XCircle,
  neutral: Circle,
  selected: CheckCircle2,
};

const ICON_STYLE: Record<OptionStatus, string> = {
  hit: "text-green-700 dark:text-green-400",
  missed: "text-amber-600 dark:text-amber-400",
  wrong: "text-destructive",
  neutral: "text-muted-foreground",
  selected: "text-primary",
};

const STATUS_LABEL = {
  hit: "grading.option.hit",
  missed: "grading.option.missed",
  wrong: "grading.option.wrong",
  neutral: "grading.option.neutral",
  selected: "grading.option.selected",
} as const;

export function optionStatus(selected: boolean, correct: boolean | null): OptionStatus {
  if (correct === null) return selected ? "selected" : "neutral";
  if (correct) return selected ? "hit" : "missed";
  return selected ? "wrong" : "neutral";
}

export function ChoiceAnswer({ question, value }: { question: Question; value: unknown }) {
  const { t } = useTranslation();
  const selected = new Set(Array.isArray(value) ? value.map(String) : []);
  const correct = new Set(question.correctAnswers ?? []);
  const scored = correct.size > 0;
  const known = new Set((question.options ?? []).map((o) => o.id));
  const removed = [...selected]
    .filter((id) => !known.has(id))
    .map((id) => ({ id, label: t("grading.option.removed") }));

  return (
    <ul className="grid gap-1.5">
      {[...(question.options ?? []), ...removed].map((option) => {
        const status = optionStatus(selected.has(option.id), scored ? correct.has(option.id) : null);
        const Icon = STATUS_ICON[status];
        return (
          <li
            key={option.id}
            className={cn("flex items-center gap-2 rounded-md border px-3 py-2 text-sm", STATUS_STYLE[status])}
          >
            <Icon aria-hidden className={cn("size-4 shrink-0", ICON_STYLE[status])} />
            <span className="min-w-0 flex-1 break-words">{option.label}</span>
            <span className="text-xs text-muted-foreground">{t(STATUS_LABEL[status])}</span>
          </li>
        );
      })}
    </ul>
  );
}
