"use client";

import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Checkbox } from "@/app/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group";
import type { Option, Question } from "@/app/types/survey";
import type { QuestionEditorProps } from "@/app/components/question-types/types";
import { useTranslation } from "@/app/i18n/context";

const SCORABLE = new Set<Question["type"]>([
  "multiple-choice",
  "dropdown",
  "checkboxes",
  "short-answer",
  "slider",
  "rating",
]);

/** Quiz config for a question: points + correct answer(s) (issue #10). */
export function QuestionQuizEditor({ question, onChange }: QuestionEditorProps) {
  const { t } = useTranslation();
  const correct = question.correctAnswers ?? [];

  function setCorrect(next: string[]) {
    onChange({ correctAnswers: next });
  }

  function answerConfig() {
    if (question.type === "multiple-choice" || question.type === "dropdown") {
      const options: Option[] = question.options ?? [];
      return (
        <RadioGroup
          value={correct[0] ?? ""}
          onValueChange={(v) => setCorrect([v])}
          className="grid gap-2"
        >
          {options.map((o) => (
            <div key={o.id} className="flex items-center gap-2">
              <RadioGroupItem value={o.id} id={`correct-${question.id}-${o.id}`} />
              <Label htmlFor={`correct-${question.id}-${o.id}`} className="font-normal">
                {o.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      );
    }

    if (question.type === "checkboxes") {
      const options: Option[] = question.options ?? [];
      return (
        <div className="grid gap-2">
          {options.map((o) => (
            <div key={o.id} className="flex items-center gap-2">
              <Checkbox
                id={`correct-${question.id}-${o.id}`}
                checked={correct.includes(o.id)}
                onCheckedChange={(c) =>
                  setCorrect(
                    c === true
                      ? [...correct, o.id]
                      : correct.filter((id) => id !== o.id),
                  )
                }
              />
              <Label htmlFor={`correct-${question.id}-${o.id}`} className="font-normal">
                {o.label}
              </Label>
            </div>
          ))}
        </div>
      );
    }

    if (question.type === "slider" || question.type === "rating") {
      const tolerance = Number(question.settings?.tolerance) || 0;
      return (
        <div className="flex flex-wrap gap-3">
          <div className="grid gap-1">
            <Label className="text-xs">{t("builder.quiz.correctValue")}</Label>
            <Input
              type="number"
              className="w-28"
              value={correct[0] ?? ""}
              onChange={(e) => setCorrect(e.target.value ? [e.target.value] : [])}
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
                  settings: {
                    ...(question.settings ?? {}),
                    tolerance: Number(e.target.value) || 0,
                  },
                })
              }
            />
          </div>
        </div>
      );
    }

    // short-answer
    return (
      <div className="grid gap-1">
        <Label className="text-xs">{t("builder.quiz.acceptedAnswers")}</Label>
        <Textarea
          value={correct.join("\n")}
          onChange={(e) =>
            setCorrect(
              e.target.value.split("\n").flatMap((s) => {
                const trimmed = s.trim();
                return trimmed ? [trimmed] : [];
              }),
            )
          }
          placeholder={t("builder.quiz.acceptedPlaceholder")}
        />
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

  return (
    <div className="grid gap-3 rounded-lg border border-dashed p-3">
      <div className="flex items-center gap-2">
        <Label htmlFor={`points-${question.id}`} className="text-sm font-medium">
          {t("builder.quiz.points")}
        </Label>
        <Input
          id={`points-${question.id}`}
          type="number"
          min={0}
          className="w-24"
          value={question.points ?? 1}
          onChange={(e) =>
            onChange({ points: e.target.value ? Number(e.target.value) : 1 })
          }
        />
      </div>
      <div className="grid gap-1">
        <span className="text-sm font-medium">{t("builder.quiz.correctAnswer")}</span>
        {answerConfig()}
      </div>
    </div>
  );
}
