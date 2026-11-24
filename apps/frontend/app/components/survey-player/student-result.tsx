"use client";

import { Badge } from "@/app/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { useTranslation } from "@/app/i18n/context";
import { formatAnswer } from "@/app/lib/survey/export";
import { hasAnswer, isManuallyGraded, maxPointsFor } from "@/app/lib/survey/grading";
import type { AnswerInput, Question, GradeStep, StudentResult, SurveyResponseDto } from "@/app/types/survey";
import { cn } from "@/lib/utils";
import { ResultPages } from "./result-pages";

export function StudentResultView({ result }: { result: StudentResult }) {
  const { t } = useTranslation();
  const { survey, response } = result;
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
          {survey.settings.showGradingScale && (
            <GradingScale steps={survey.settings.gradingScale ?? []} response={response} />
          )}
        </CardContent>
      </Card>

      <ResultPages
        survey={survey}
        answers={response.answers}
        renderQuestion={(q) => (
          <AnswerRow question={q} answer={response.answers.find((a) => a.questionId === q.id)} />
        )}
      />
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

function GradingScale({
  steps,
  response,
}: {
  steps: GradeStep[];
  response: SurveyResponseDto;
}) {
  const { t } = useTranslation();
  const scale = steps
    .filter((s): s is GradeStep & { minScore: number } => !!s.label.trim() && s.minScore != null)
    .toSorted((a, b) => b.minScore - a.minScore);
  if (scale.length === 0) return null;
  const score = response.gradingPending ? null : response.score;
  const current = score == null ? -1 : scale.findIndex((s) => s.minScore <= score);
  const next = score == null ? undefined : current === -1 ? scale.at(-1) : scale[current - 1];
  return (
    <div className="grid gap-1">
      <p className="text-sm font-medium">{t("studentResult.scale")}</p>
      <Table className="w-auto">
        <TableHeader>
          <TableRow>
            <TableHead>{t("studentResult.grade")}</TableHead>
            <TableHead>{t("builder.grading.minScore")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {scale.map((step, i) => (
            <TableRow
              key={i}
              aria-current={i === current || undefined}
              className={cn(i === current && "bg-primary/10 font-semibold")}
            >
              <TableCell>{step.label}</TableCell>
              <TableCell className="tabular-nums">{step.minScore}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {next && score != null && (
        <p className="text-sm text-muted-foreground">
          {t("studentResult.nextGrade", {
            points: String(next.minScore - score),
            grade: next.label,
          })}
        </p>
      )}
    </div>
  );
}
