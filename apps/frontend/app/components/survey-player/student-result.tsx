"use client";

import { Badge } from "@/app/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { useTranslation } from "@/app/i18n/context";
import { isAnswerable } from "@/app/lib/survey/content-block";
import { formatAnswer } from "@/app/lib/survey/export";
import { hasAnswer, isManuallyGraded, maxPointsFor } from "@/app/lib/survey/grading";
import type { AnswerInput, Question, StudentResult } from "@/app/types/survey";

export function StudentResultView({ result }: { result: StudentResult }) {
  const { t } = useTranslation();
  const { survey, response } = result;
  const questions = survey.questions
    .filter((q) => isAnswerable(q.type))
    .toSorted((a, b) => a.order - b.order);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{survey.title}</CardTitle>
          {response.respondentName && (
            <p className="text-sm text-muted-foreground">{response.respondentName}</p>
          )}
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-3xl font-bold tabular-nums">
              {response.score ?? 0} / {response.maxScore ?? 0}
            </span>
            {response.grade && (
              <Badge className="text-base">
                {t("studentResult.grade")}: {response.grade}
              </Badge>
            )}
            {response.passed != null && (
              <Badge variant={response.passed ? "default" : "destructive"}>
                {response.passed ? t("player.passed") : t("player.failed")}
              </Badge>
            )}
          </div>
          {response.bonusPoints != null && (
            <p className="text-sm text-muted-foreground">
              {t("studentResult.bonus", { points: String(response.bonusPoints) })}
            </p>
          )}
          {response.gradingPending && (
            <p className="text-sm text-muted-foreground">{t("player.gradingPending")}</p>
          )}
          {response.feedback && (
            <div className="grid gap-1 rounded-lg border p-3">
              <p className="text-sm font-medium">{t("studentResult.feedback")}</p>
              <p className="text-sm break-words whitespace-pre-wrap">{response.feedback}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {questions.map((q) => (
        <AnswerRow
          key={q.id}
          question={q}
          answer={response.answers.find((a) => a.questionId === q.id)}
        />
      ))}
    </div>
  );
}

function AnswerRow({ question, answer }: { question: Question; answer?: AnswerInput }) {
  const { t } = useTranslation();
  const answered = hasAnswer(answer?.value);
  const scored = (answer?.autoPoints != null || isManuallyGraded(question)) && maxPointsFor(question) > 0;
  const earned = answer?.awardedPoints ?? answer?.autoPoints ?? null;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <CardTitle className="min-w-0 text-base font-medium">
          {question.title || t("results.untitledQuestion")}
        </CardTitle>
        {scored && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {answered ? (earned ?? "–") : 0} / {maxPointsFor(question)}
          </span>
        )}
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-sm break-words whitespace-pre-wrap">
          {answered ? formatAnswer(question, answer?.value) : t("grading.noAnswer")}
        </p>
        {answer?.feedback && (
          <div className="grid gap-1 rounded-lg border p-3">
            <p className="text-sm font-medium">{t("studentResult.answerFeedback")}</p>
            <p className="text-sm break-words whitespace-pre-wrap">{answer.feedback}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
