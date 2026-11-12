"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, UserRound } from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Skeleton } from "@/app/components/ui/skeleton";
import { useResponses, useSurvey } from "@/app/hooks/survey";
import { useTranslation } from "@/app/i18n/context";
import {
  groupAnswers,
  isAutoScored,
  isGradable,
  maxPointsFor,
} from "@/app/lib/survey/grading";
import { AnswerGroupCard } from "./answer-group-card";

interface QuestionGradingViewProps {
  surveyId: string;
  questionId: string;
  sessionId: string | null;
}

export function QuestionGradingView({ surveyId, questionId, sessionId }: QuestionGradingViewProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const survey = useSurvey(surveyId);
  const responses = useResponses(surveyId, sessionId);
  const query = sessionId ? `?session=${encodeURIComponent(sessionId)}` : "";

  const ordered = useMemo(
    () =>
      (responses.data ?? []).toSorted(
        (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
      ),
    [responses.data],
  );

  const gradable = useMemo(() => {
    const settings = survey.data?.settings;
    if (!settings?.isQuiz) return [];
    return survey.data!.questions
      .filter((q) => isGradable(q, settings.liveMode === true))
      .toSorted((a, b) => a.order - b.order);
  }, [survey.data]);

  const goTo = useCallback(
    (id: string) => router.replace(`/surveys/${surveyId}/results/grade-question/${id}${query}`),
    [router, surveyId, query],
  );

  if (survey.isLoading || responses.isLoading) {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-8">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const backHref = `/surveys/${surveyId}/results`;
  const index = gradable.findIndex((q) => q.id === questionId);
  const question = index >= 0 ? gradable[index] : undefined;
  if (!question) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <BackLink href={backHref} label={t("grading.back")} />
        <p className="mt-6 text-sm text-muted-foreground">{t("grading.byQuestion.notFound")}</p>
      </div>
    );
  }

  const groups = groupAnswers(question, ordered);
  const answered = groups.reduce((n, g) => n + g.responses.length, 0);
  const ungraded = isAutoScored(question)
    ? 0
    : groups
        .flatMap((g) => g.responses)
        .filter((r) => r.answers.find((a) => a.questionId === question.id)?.awardedPoints == null).length;
  const position = new Map(ordered.map((r, i) => [r.id, i + 1]));
  const studentLabel = (responseId: string) => {
    const response = ordered.find((r) => r.id === responseId);
    return response?.respondentName || `${t("grading.anonymous")} #${position.get(responseId)}`;
  };
  const studentHref = (responseId: string) => `/surveys/${surveyId}/results/grade/${responseId}${query}`;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8">
      <div className="grid gap-3">
        <BackLink href={backHref} label={t("grading.back")} />
        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">
            {t("grading.byQuestion.position", { n: String(index + 1), total: String(gradable.length) })}
            {" · "}
            {t("grading.byQuestion.maxPoints", { max: String(maxPointsFor(question)) })}
          </p>
          <h1 className="text-2xl font-bold tracking-tight break-words">
            {question.title || t("results.untitledQuestion")}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={index <= 0} onClick={() => goTo(gradable[index - 1].id)}>
            <ChevronLeft className="size-4" /> {t("grading.byQuestion.previous")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={index >= gradable.length - 1}
            onClick={() => goTo(gradable[index + 1].id)}
          >
            {t("grading.byQuestion.next")} <ChevronRight className="size-4" />
          </Button>
          {ordered[0] && (
            <Button asChild variant="ghost" size="sm">
              <Link href={studentHref(ordered[0].id)}>
                <UserRound className="size-4" /> {t("grading.byStudent")}
              </Link>
            </Button>
          )}
          {ungraded > 0 && <Badge variant="secondary">{t("grading.byQuestion.ungraded", { n: String(ungraded) })}</Badge>}
          {isAutoScored(question) && <Badge variant="outline">{t("grading.autoScored")}</Badge>}
        </div>
      </div>

      {groups.map((group) => (
        <AnswerGroupCard
          key={`${question.id}-${group.key}`}
          surveyId={surveyId}
          question={question}
          group={group}
          studentLabel={studentLabel}
          studentHref={studentHref}
          commentable={survey.data?.settings.liveMode !== true}
        />
      ))}

      {groups.length === 0 && <p className="text-sm text-muted-foreground">{t("grading.byQuestion.noAnswers")}</p>}
      {ordered.length > answered && (
        <p className="text-sm text-muted-foreground">
          {t("grading.byQuestion.unanswered", { n: String(ordered.length - answered) })}
        </p>
      )}
    </div>
  );
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" />
      {label}
    </Link>
  );
}
