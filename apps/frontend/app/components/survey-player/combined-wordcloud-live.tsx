"use client";

import { useEffect, useMemo } from "react";
import { useLiveResults } from "@/app/hooks/survey";
import { useLiveResultsSocket } from "@/app/hooks/results-live";
import { useTranslation } from "@/app/i18n/context";
import { Spinner } from "@/app/components/ui/spinner";
import { CombinedWordcloudCard } from "@/app/components/survey-results/combined-wordcloud-card";
import { inCombinedWordcloud } from "@/app/lib/results/combined-wordcloud";
import { RESULTS_POLL_INTERVAL_MS } from "@/app/lib/survey/constants";
import { isQuestionVisible } from "@/app/lib/survey/logic";
import type { AnswerValue } from "@/app/lib/survey/validation";
import type { Question, QuestionResult, Survey } from "@/app/types/survey";

function liveClouds({ questions, settings }: Survey): Question[] {
  return questions.filter((q) => inCombinedWordcloud(q, settings.isQuiz) && q.showInLiveResults !== false);
}

export function CombinedWordcloudLive({
  survey,
  answers,
  preview = false,
}: {
  survey: Survey;
  answers: Record<string, AnswerValue>;
  preview?: boolean;
}) {
  return preview ? <OwnWordcloud survey={survey} answers={answers} /> : <LiveWordcloud survey={survey} />;
}

function OwnWordcloud({ survey, answers }: { survey: Survey; answers: Record<string, AnswerValue> }) {
  const { t } = useTranslation();
  const results = useMemo<QuestionResult[]>(
    () =>
      liveClouds(survey)
        .filter((q) => isQuestionVisible(q, answers))
        .map((q) => {
          const value = answers[q.id];
          const picked = Array.isArray(value) ? (value as string[]) : typeof value === "string" ? [value] : [];
          const keys = q.type === "wordcloud" ? picked : (q.options ?? []).map((o) => o.id);
          return {
            questionId: q.id,
            type: q.type,
            title: q.title,
            answered: picked.length > 0 ? 1 : 0,
            optionCounts: Object.fromEntries(keys.map((k) => [k, picked.includes(k) ? 1 : 0])),
          };
        }),
    [survey, answers],
  );

  if (results.length === 0) return null;
  const hasWords = results.some((r) => r.answered > 0);

  return (
    <div className="grid w-full gap-2 text-left">
      {hasWords && <CombinedWordcloudCard questions={survey.questions} results={results} />}
      <p className="text-center text-sm text-muted-foreground">{t("wordcloud.combined.previewNote")}</p>
    </div>
  );
}

function LiveWordcloud({ survey }: { survey: Survey }) {
  const { t } = useTranslation();
  const cloudIds = new Set(liveClouds(survey).map((q) => q.id));
  const hasClouds = cloudIds.size > 0;
  const connected = useLiveResultsSocket(survey.id, hasClouds);
  const live = useLiveResults(
    survey.id,
    hasClouds,
    connected ? false : RESULTS_POLL_INTERVAL_MS,
    survey.run?.id,
  );
  const { refetch } = live;

  useEffect(() => {
    if (connected) void refetch();
  }, [connected, refetch]);

  if (!hasClouds) return null;
  if (live.isLoading) return <Spinner className="size-5" />;
  if (live.isError && !live.data) {
    return (
      <p role="status" className="text-center text-sm text-muted-foreground">
        {t("wordcloud.combined.loadFailed")}
      </p>
    );
  }
  if (!live.data?.questions.some((r) => cloudIds.has(r.questionId))) return null;

  return (
    <div className="w-full text-left">
      <CombinedWordcloudCard questions={survey.questions} results={live.data.questions} live={connected} />
    </div>
  );
}
