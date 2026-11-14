"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { useTranslation } from "@/app/i18n/context";
import { formatAnswer } from "@/app/lib/survey/export";
import { hasAnswer } from "@/app/lib/survey/grading";
import { buildPages } from "@/app/lib/survey/pagination";
import type { AnswerValue } from "@/app/lib/survey/validation";
import type { AnswerCorrection, Survey } from "@/app/types/survey";

export function AnswerCorrections({
  survey,
  answers,
  corrections,
}: {
  survey: Survey;
  answers: Record<string, AnswerValue>;
  corrections: AnswerCorrection[];
}) {
  const { t } = useTranslation();
  const questions = new Map(
    buildPages(survey, answers).flatMap((page) => page.questions.map((q) => [q.id, q] as const)),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("player.yourAnswers")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {corrections.map((c) => {
          const question = questions.get(c.questionId);
          if (!question) return null;
          const Icon = c.correct ? CheckCircle2 : XCircle;
          return (
            <div key={c.questionId} data-testid={`correction-${c.questionId}`} className="grid gap-1 rounded-lg border p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 font-medium">{question.title || t("results.untitledQuestion")}</p>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {c.points} / {c.maxPoints}
                </span>
              </div>
              <p className={`flex items-center gap-1.5 ${c.correct ? "text-primary" : "text-destructive"}`}>
                <Icon className="size-4 shrink-0" />
                <span className="sr-only">{t(c.correct ? "player.correct" : "player.incorrect")}</span>
                <span className="break-words">
                  {hasAnswer(c.answer) ? formatAnswer(question, c.answer) : t("grading.noAnswer")}
                </span>
              </p>
              {!c.correct && (
                <p className="break-words text-muted-foreground">
                  {t("player.correctAnswer")}: {formatAnswer(question, c.correctAnswers)}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
