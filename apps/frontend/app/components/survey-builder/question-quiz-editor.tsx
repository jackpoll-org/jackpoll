"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Switch } from "@/app/components/ui/switch";
import type { Question } from "@/app/types/survey";
import type { QuestionEditorProps } from "@/app/components/question-types/types";
import { useTranslation } from "@/app/i18n/context";
import {
  CHOICE_TYPES,
  POINTS_LIMIT,
  answerPoints,
  basePoints,
  isAutoScored,
  isManuallyGraded,
  maxPointsFor,
  optionPoints,
  ownPoints,
  withoutOptionPoints,
} from "@/app/lib/survey/grading";

const SCORABLE = new Set<Question["type"]>([
  "multiple-choice",
  "dropdown",
  "checkboxes",
  "short-answer",
  "slider",
  "rating",
  "ranking",
]);

/** Whether the question carries a points value in a quiz. */
export function hasQuizPoints(question: Question): boolean {
  return (SCORABLE.has(question.type) && isAutoScored(question)) || isManuallyGraded(question);
}

/** Points next to the question title; read-only when the points come from its answers. */
export function QuizPointsField({ question, onChange }: QuestionEditorProps) {
  const { t } = useTranslation();
  const derived = optionPoints(question) != null || answerPoints(question) != null;

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Label htmlFor={`points-${question.id}`} className="text-sm text-muted-foreground">
        {t("builder.quiz.points")}
      </Label>
      <Input
        id={`points-${question.id}`}
        type="number"
        min={0}
        className="w-20"
        value={derived ? maxPointsFor(question) : (question.points ?? 1)}
        readOnly={derived}
        title={derived ? t("builder.quiz.pointsDerived") : undefined}
        onChange={(e) => onChange({ points: e.target.value ? Number(e.target.value) : 1 })}
      />
    </div>
  );
}

function AcceptedAnswersEditor({ question, onChange }: QuestionEditorProps) {
  const { t } = useTranslation();
  const answers = question.correctAnswers ?? [];
  const points = answerPoints(question) ?? {};
  const base = basePoints(question);

  function update(nextAnswers: string[], nextPoints: Record<string, number>) {
    const kept = Object.fromEntries(
      nextAnswers.flatMap((a) => (Object.hasOwn(nextPoints, a) ? [[a, nextPoints[a]]] : [])),
    );
    const rest = Object.fromEntries(
      Object.entries(question.settings ?? {}).filter(([key]) => key !== "answerPoints"),
    );
    onChange({
      correctAnswers: nextAnswers,
      settings: Object.keys(kept).length > 0 ? { ...rest, answerPoints: kept } : rest,
    });
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">{t("builder.quiz.acceptedAnswers")}</span>
      {answers.map((answer, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={answer}
            placeholder={t("builder.quiz.acceptedPlaceholder")}
            aria-label={t("builder.quiz.acceptedAnswer", { n: String(i + 1) })}
            onChange={(e) => {
              const next = answers.map((a, j) => (j === i ? e.target.value : a));
              const moved = Object.fromEntries(
                Object.entries(points).map(([key, p]) => [key === answer ? e.target.value : key, p]),
              );
              update(next, moved);
            }}
          />
          <Input
            type="number"
            step={1}
            min={0}
            className="w-20 shrink-0"
            value={ownPoints(points, answer) ?? ""}
            placeholder={String(base)}
            aria-label={t("builder.quiz.pointsFor", { label: answer || String(i + 1) })}
            onChange={(e) => {
              const others = Object.entries(points).filter(([key]) => key !== answer);
              const value = Math.max(0, Math.min(POINTS_LIMIT, Math.trunc(Number(e.target.value)) || 0));
              update(
                answers,
                Object.fromEntries(e.target.value === "" ? others : [...others, [answer, value]]),
              );
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("qedit.removeItem", { label: answer || String(i + 1) })}
            onClick={() => update(answers.filter((_, j) => j !== i), points)}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <div>
        <Button type="button" variant="outline" size="sm" onClick={() => update([...answers, ""], points)}>
          <Plus className="size-4" />
          {t("builder.quiz.addAnswer")}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`case-sensitive-${question.id}`}
          checked={question.caseSensitiveAnswers ?? false}
          onCheckedChange={(c) => onChange({ caseSensitiveAnswers: c === true })}
        />
        <Label htmlFor={`case-sensitive-${question.id}`} className="text-xs font-normal">
          {t("builder.quiz.caseSensitive")}
        </Label>
      </div>
    </div>
  );
}

function ManualGradingToggle({ question, onChange }: QuestionEditorProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <Switch
        id={`manual-${question.id}`}
        checked={question.settings?.manualGrading === true}
        onCheckedChange={(c) =>
          onChange({ settings: { ...(question.settings ?? {}), manualGrading: c } })
        }
      />
      <Label htmlFor={`manual-${question.id}`} className="font-normal">
        {t("builder.quiz.gradeManually")}
      </Label>
    </div>
  );
}

/** Quiz config below the answers: scoring mode, accepted answers, tolerance (issue #10). */
export function QuestionQuizEditor({
  question,
  onChange,
  liveMode = false,
}: QuestionEditorProps & { liveMode?: boolean }) {
  const { t } = useTranslation();
  const correct = question.correctAnswers ?? [];

  if (question.type === "long-answer" || question.type === "file-upload") {
    const manual = isManuallyGraded(question);
    return (
      <div className="grid gap-3 rounded-lg border border-dashed p-3">
        {question.type === "file-upload" && <ManualGradingToggle question={question} onChange={onChange} />}
        <p className="text-xs text-muted-foreground">
          {manual ? t("builder.quiz.manualHint") : t("builder.quiz.notScored")}
        </p>
      </div>
    );
  }

  if (!SCORABLE.has(question.type)) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        {t("builder.quiz.notScored")}
      </div>
    );
  }

  if (CHOICE_TYPES.has(question.type)) {
    const perOption = optionPoints(question) != null;
    return (
      <div className="grid gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        <p>
          {perOption
            ? question.type === "checkboxes"
              ? t("builder.quiz.optionPointsSumHint")
              : t("builder.quiz.optionPointsSingleHint")
            : t("builder.quiz.markCorrectHint")}
        </p>
        {perOption && (
          <div>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => onChange({ settings: withoutOptionPoints(question) })}
            >
              {t("builder.quiz.resetOptionPoints")}
            </Button>
          </div>
        )}
        {question.type === "checkboxes" && !perOption && !liveMode && (
          <div className="grid gap-1 pt-1">
            <div className="flex items-center gap-2 text-foreground">
              <Switch
                id={`partial-${question.id}`}
                checked={question.settings?.partialCredit === true}
                onCheckedChange={(c) =>
                  onChange({ settings: { ...(question.settings ?? {}), partialCredit: c } })
                }
              />
              <Label htmlFor={`partial-${question.id}`} className="font-normal">
                {t("builder.quiz.partialCredit")}
              </Label>
            </div>
            <p>{t("builder.quiz.partialCreditHint")}</p>
          </div>
        )}
      </div>
    );
  }

  if (question.type === "ranking") {
    return (
      <div className="grid gap-1 rounded-lg border border-dashed p-3">
        <div className="flex items-center gap-2">
          <Switch
            id={`score-order-${question.id}`}
            checked={question.settings?.scoreOrder === true}
            onCheckedChange={(c) =>
              onChange({ settings: { ...(question.settings ?? {}), scoreOrder: c } })
            }
          />
          <Label htmlFor={`score-order-${question.id}`} className="font-normal">
            {t("builder.quiz.scoreOrder")}
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">{t("builder.quiz.scoreOrderHint")}</p>
      </div>
    );
  }

  if (question.type === "slider" || question.type === "rating") {
    const tolerance = Number(question.settings?.tolerance) || 0;
    return (
      <div className="flex flex-wrap gap-3 rounded-lg border border-dashed p-3">
        <div className="grid gap-1">
          <Label className="text-xs">{t("builder.quiz.correctValue")}</Label>
          <Input
            type="number"
            className="w-28"
            value={correct[0] ?? ""}
            onChange={(e) => onChange({ correctAnswers: e.target.value ? [e.target.value] : [] })}
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">{t("builder.quiz.tolerance")}</Label>
          <Input
            type="number"
            min={0}
            className="w-28"
            value={tolerance}
            onChange={(e) =>
              onChange({
                settings: { ...(question.settings ?? {}), tolerance: Number(e.target.value) || 0 },
              })
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-lg border border-dashed p-3">
      <AcceptedAnswersEditor question={question} onChange={onChange} />
      {correct.every((c) => c.trim() === "") && (
        <>
          <ManualGradingToggle question={question} onChange={onChange} />
          <p className="text-xs text-muted-foreground">
            {isManuallyGraded(question) ? t("builder.quiz.manualHint") : t("builder.quiz.needsKeyOrManual")}
          </p>
        </>
      )}
    </div>
  );
}
