"use client";

import { useState } from "react";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Input } from "@/app/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group";
import type { Option } from "@/app/types/survey";
import type { QuestionEditorProps } from "../types";
import { OptionListEditor } from "./option-list-editor";
import { useTranslation } from "@/app/i18n/context";
import {
  CHOICE_TYPES,
  POINTS_LIMIT,
  correctFromPoints,
  optionPoints,
  ownPoints,
  scoresOrder,
  seededOptionPoints,
  withOptionPoints,
  withoutOptionPoints,
} from "@/app/lib/survey/grading";

function CorrectMarker({ question, option, onChange }: QuestionEditorProps & { option: Option }) {
  const { t } = useTranslation();
  const correct = question.correctAnswers ?? [];
  const label = t("builder.quiz.markCorrect", { label: option.label || t("qedit.noun.option") });
  const fromPoints = optionPoints(question) != null;

  if (question.type !== "checkboxes") {
    return <RadioGroupItem value={option.id} aria-label={label} disabled={fromPoints} />;
  }
  return (
    <Checkbox
      checked={correct.includes(option.id)}
      aria-label={label}
      disabled={fromPoints}
      onCheckedChange={(c) =>
        onChange({
          correctAnswers: c === true ? [...correct, option.id] : correct.filter((id) => id !== option.id),
        })
      }
    />
  );
}

function OptionPointsInput({ question, option, onChange }: QuestionEditorProps & { option: Option }) {
  const { t } = useTranslation();
  const explicit = optionPoints(question);
  const value = explicit ? ownPoints(explicit, option.id) : undefined;
  const placeholder = explicit ? 0 : (ownPoints(seededOptionPoints(question), option.id) ?? 0);
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Input
      type="number"
      step={1}
      min={-POINTS_LIMIT}
      max={POINTS_LIMIT}
      className="w-20 shrink-0"
      value={draft ?? (value ?? "")}
      placeholder={String(placeholder)}
      aria-label={t("builder.quiz.pointsFor", { label: option.label || t("qedit.noun.option") })}
      onChange={(e) => {
        setDraft(e.target.value);
        if (e.target.value === "") return;
        const points = Math.trunc(Number(e.target.value));
        if (Number.isFinite(points)) {
          const bounded = Math.max(-POINTS_LIMIT, Math.min(POINTS_LIMIT, points));
          if (bounded !== points) setDraft(String(bounded));
          onChange(withOptionPoints(question, option.id, bounded));
        }
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

/** Editor for multiple-choice, checkboxes, dropdown and ranking — a single list of options. */
export function ChoiceEditor({ question, onChange, isQuiz }: QuestionEditorProps) {
  const { t } = useTranslation();
  const options: Option[] = question.options ?? [];
  const showCapacity =
    !isQuiz && (question.type === "multiple-choice" || question.type === "dropdown");
  const quizChoice = isQuiz === true && CHOICE_TYPES.has(question.type);
  const numbered = isQuiz === true && scoresOrder(question);

  const editor = (
    <OptionListEditor
      label={showCapacity ? t("qedit.choice.optionsLimit") : t("qedit.choice.options")}
      options={options}
      onChange={(next) => {
        const points = optionPoints(question);
        if (!points) return onChange({ options: next });
        const kept = Object.fromEntries(next.flatMap((o) => (Object.hasOwn(points, o.id) ? [[o.id, points[o.id]]] : [])));
        if (Object.keys(kept).length === 0) {
          const ids = new Set(next.map((o) => o.id));
          return onChange({
            options: next,
            settings: withoutOptionPoints(question),
            correctAnswers: (question.correctAnswers ?? []).filter((id) => ids.has(id)),
          });
        }
        onChange({
          options: next,
          settings: { ...(question.settings ?? {}), optionPoints: kept },
          correctAnswers: correctFromPoints(question, kept),
        });
      }}
      addLabel={t("qedit.addOption")}
      itemNoun={t("qedit.noun.option")}
      showCapacity={showCapacity}
      renderLeading={
        quizChoice
          ? (option) => <CorrectMarker question={question} option={option} onChange={onChange} />
          : numbered
            ? (_option, index) => (
                <span className="w-5 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                  {index + 1}.
                </span>
              )
            : undefined
      }
      renderTrailing={
        quizChoice
          ? (option) => <OptionPointsInput question={question} option={option} onChange={onChange} />
          : undefined
      }
    />
  );

  if (!quizChoice || question.type === "checkboxes") return editor;
  return (
    <RadioGroup
      value={question.correctAnswers?.[0] ?? ""}
      onValueChange={(v) => onChange({ correctAnswers: [v] })}
      aria-label={t("builder.quiz.correctAnswer")}
    >
      {editor}
    </RadioGroup>
  );
}

