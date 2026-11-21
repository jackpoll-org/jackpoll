"use client";

import { useEffect, useMemo } from "react";
import { useLiveResults } from "@/app/hooks/survey";
import { useLiveResultsSocket } from "@/app/hooks/results-live";
import { useTranslation } from "@/app/i18n/context";
import { Spinner } from "@/app/components/ui/spinner";
import { CombinedWordcloudCard } from "@/app/components/survey-results/combined-wordcloud-card";
import { RESULTS_POLL_INTERVAL_MS } from "@/app/lib/survey/constants";
import { isQuestionVisible } from "@/app/lib/survey/logic";
import type { AnswerValue } from "@/app/lib/survey/validation";
import type { Question, QuestionResult, Survey } from "@/app/types/survey";

function liveClouds(questions: Question[]): Question[] {
  return questions.filter((q) => q.type === "wordcloud" && q.showInLiveResults !== false);
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
      liveClouds(survey.questions)
        .filter((q) => isQuestionVisible(q, answers))
        .map((q) => {
          const words = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
          return {
            questionId: q.id,
            type: q.type,
            title: q.title,
            answered: words.length > 0 ? 1 : 0,
            optionCounts: Object.fromEntries(words.map((w) => [w, 1])),
          };
        }),
    [survey.questions, answers],
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
  const hasClouds = liveClouds(survey.questions).length > 0;
  const connected = useLiveResultsSocket(survey.id, hasClouds);
  const live = useLiveResults(survey.id, hasClouds, connected ? false : RESULTS_POLL_INTERVAL_MS);
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
  if (!live.data?.questions.some((r) => r.type === "wordcloud")) return null;

  return (
    <div className="w-full text-left">
      <CombinedWordcloudCard questions={survey.questions} results={live.data.questions} live={connected} />
    </div>
  );
}
