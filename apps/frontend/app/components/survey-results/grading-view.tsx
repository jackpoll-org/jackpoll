"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  SkipForward,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Skeleton } from "@/app/components/ui/skeleton";
import { useGradeResponse, useResponses, useSurvey } from "@/app/hooks/survey";
import { useTranslation } from "@/app/i18n/context";
import { uploadFileUrl } from "@/app/lib/survey/api";
import { isAnswerable } from "@/app/lib/survey/content-block";
import { formatAnswer } from "@/app/lib/survey/export";
import {
  hasAnswer,
  isManuallyGraded,
  maxPointsFor,
  nextPendingIndex,
} from "@/app/lib/survey/grading";
import type { Question, SurveyResponseDto, UploadedFile } from "@/app/types/survey";

interface GradingViewProps {
  surveyId: string;
  responseId: string;
  /** Live quizzes: grade within one round, like the results page filter. */
  sessionId: string | null;
}

/**
 * Student-by-student grading (public #6): one submission per page with all its
 * answers, downloadable files, points for manually graded answers, the running
 * total, and previous/next navigation (buttons or ←/→).
 */
export function GradingView({ surveyId, responseId, sessionId }: GradingViewProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const survey = useSurvey(surveyId);
  const responses = useResponses(surveyId, sessionId);

  const ordered = useMemo(
    () =>
      (responses.data ?? []).toSorted(
        (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
      ),
    [responses.data],
  );
  const index = ordered.findIndex((r) => r.id === responseId);
  const response = index >= 0 ? ordered[index] : undefined;

  const goTo = useCallback(
    (i: number) => {
      const target = ordered[i];
      if (!target) return;
      const query = sessionId ? `?session=${encodeURIComponent(sessionId)}` : "";
      router.replace(`/surveys/${surveyId}/results/grade/${target.id}${query}`);
    },
    [ordered, router, sessionId, surveyId],
  );

  // ←/→ flip submissions, unless the teacher is typing points.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target;
      if (target instanceof Element && target.closest("input, textarea, [contenteditable=true]")) {
        return;
      }
      if (e.key === "ArrowLeft" && index > 0) goTo(index - 1);
      if (e.key === "ArrowRight" && index < ordered.length - 1) goTo(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, index, ordered.length]);

  if (survey.isLoading || responses.isLoading) {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-8">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const backHref = `/surveys/${surveyId}/results`;
  if (!survey.data || !response) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <BackLink href={backHref} label={t("grading.back")} />
        <p className="mt-6 text-sm text-muted-foreground">{t("grading.notFound")}</p>
      </div>
    );
  }

  const questions = survey.data.questions
    .filter((q) => isAnswerable(q.type))
    .toSorted((a, b) => a.order - b.order);
  const pendingIndex = nextPendingIndex(ordered, index);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8">
      <div className="grid gap-3">
        <BackLink href={backHref} label={t("grading.back")} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">
              {response.respondentName || t("grading.anonymous")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("grading.position", {
                n: String(index + 1),
                total: String(ordered.length),
              })}{" "}
              · {new Date(response.submittedAt).toLocaleString()}
            </p>
          </div>
          <ScoreSummary response={response} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={index <= 0} onClick={() => goTo(index - 1)}>
            <ChevronLeft className="size-4" /> {t("grading.previous")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={index >= ordered.length - 1}
            onClick={() => goTo(index + 1)}
          >
            {t("grading.next")} <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={pendingIndex < 0 || pendingIndex === index}
            onClick={() => goTo(pendingIndex)}
          >
            <SkipForward className="size-4" /> {t("grading.nextUngraded")}
          </Button>
        </div>
      </div>

      {questions.map((q) => (
        <AnswerCard
          // Remount per submission so points inputs start from that response.
          key={`${response.id}-${q.id}`}
          surveyId={surveyId}
          question={q}
          response={response}
        />
      ))}
    </div>
  );
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      {label}
    </Link>
  );
}

function ScoreSummary({ response }: { response: SurveyResponseDto }) {
  const { t } = useTranslation();
  if (response.score == null) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl font-semibold tabular-nums">
        {response.score}/{response.maxScore}
      </span>
      {response.gradingPending ? (
        <Badge variant="secondary">{t("grading.pending")}</Badge>
      ) : (
        response.passed != null && (
          <Badge variant={response.passed ? "default" : "destructive"}>
            {response.passed ? t("results.responses.pass") : t("results.responses.fail")}
          </Badge>
        )
      )}
    </div>
  );
}

function AnswerCard({
  surveyId,
  question,
  response,
}: {
  surveyId: string;
  question: Question;
  response: SurveyResponseDto;
}) {
  const { t } = useTranslation();
  const answer = response.answers.find((a) => a.questionId === question.id);
  const answered = hasAnswer(answer?.value);
  const manual = isManuallyGraded(question);
  const autoScored = (question.correctAnswers?.length ?? 0) > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <CardTitle className="min-w-0 text-base font-medium">
          {question.title || t("results.untitledQuestion")}
        </CardTitle>
        {manual && answered && (
          <PointsInput
            surveyId={surveyId}
            responseId={response.id}
            questionId={question.id}
            max={maxPointsFor(question)}
            initial={answer?.awardedPoints ?? null}
          />
        )}
        {manual && !answered && (
          <span className="text-xs text-muted-foreground">
            {t("grading.unansweredPoints", { max: String(maxPointsFor(question)) })}
          </span>
        )}
        {!manual && autoScored && <Badge variant="outline">{t("grading.autoScored")}</Badge>}
      </CardHeader>
      <CardContent>
        {!answered ? (
          <p className="text-sm text-muted-foreground">{t("grading.noAnswer")}</p>
        ) : question.type === "file-upload" || question.type === "signature" ? (
          <FileList files={answer?.value as UploadedFile[]} />
        ) : (
          <p className="text-sm break-words whitespace-pre-wrap">
            {formatAnswer(question, answer?.value)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function FileList({ files }: { files: UploadedFile[] }) {
  const { t } = useTranslation();
  return (
    <ul className="grid gap-2">
      {files.map((f) => {
        const url = uploadFileUrl(f.key);
        const name = f.filename || "upload";
        return (
          <li key={f.key} className="flex flex-wrap items-center gap-3">
            {f.contentType?.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element -- API-proxied upload
              <img src={url} alt={name} className="h-16 w-auto rounded border object-contain" />
            ) : (
              // PDFs, Office files and text can't be previewed inline — download them.
              <FileText aria-hidden className="size-10 text-muted-foreground" />
            )}
            <span className="min-w-0 truncate text-sm">{name}</span>
            <Button asChild variant="outline" size="sm">
              <a href={`${url}&download=1&name=${encodeURIComponent(name)}`} download={name}>
                <Download className="size-4" /> {t("grading.download")}
              </a>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

/** Points for one answer; saves when the field loses focus or on Enter. */
function PointsInput({
  surveyId,
  responseId,
  questionId,
  max,
  initial,
}: {
  surveyId: string;
  responseId: string;
  questionId: string;
  max: number;
  initial: number | null;
}) {
  const { t } = useTranslation();
  const grade = useGradeResponse(surveyId);
  const [text, setText] = useState(initial == null ? "" : String(initial));
  const [saved, setSaved] = useState(initial);
  const parsed = parsePoints(text, max);
  const invalid = parsed === "invalid";

  function save() {
    if (parsed === "invalid" || parsed === saved) return;
    grade.mutate(
      { responseId, grades: [{ questionId, points: parsed }] },
      {
        onSuccess: () => setSaved(parsed),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : t("grading.saveFailed")),
      },
    );
  }

  const id = `points-${responseId}-${questionId}`;
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-sm text-muted-foreground">
          {t("grading.points")}
        </label>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          step={1}
          className="w-20 tabular-nums"
          aria-invalid={invalid}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
        />
        <span className="text-sm text-muted-foreground tabular-nums">/ {max}</span>
      </div>
      {invalid && (
        <p className="text-xs text-destructive">
          {t("grading.invalidPoints", { max: String(max) })}
        </p>
      )}
    </div>
  );
}

/** "" clears the grade (null); otherwise a whole number within 0..max. */
export function parsePoints(text: string, max: number): number | null | "invalid" {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : "invalid";
}
