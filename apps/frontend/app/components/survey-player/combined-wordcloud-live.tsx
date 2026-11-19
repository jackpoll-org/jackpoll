"use client";

import { useEffect } from "react";
import { useLiveResults } from "@/app/hooks/survey";
import { useLiveResultsSocket } from "@/app/hooks/results-live";
import { Spinner } from "@/app/components/ui/spinner";
import { CombinedWordcloudCard } from "@/app/components/survey-results/combined-wordcloud-card";
import { RESULTS_POLL_INTERVAL_MS } from "@/app/lib/survey/constants";
import type { Survey } from "@/app/types/survey";

export function CombinedWordcloudLive({ survey }: { survey: Survey }) {
  const hasClouds = survey.questions.some((q) => q.type === "wordcloud" && q.showInLiveResults !== false);
  const connected = useLiveResultsSocket(survey.id, hasClouds);
  const live = useLiveResults(survey.id, hasClouds, connected ? false : RESULTS_POLL_INTERVAL_MS);
  const { refetch } = live;

  useEffect(() => {
    if (connected) void refetch();
  }, [connected, refetch]);

  if (!hasClouds) return null;
  if (live.isLoading) return <Spinner className="size-5" />;
  if (live.isError || !live.data?.questions.some((r) => r.type === "wordcloud")) return null;

  return (
    <div className="w-full text-left">
      <CombinedWordcloudCard questions={survey.questions} results={live.data.questions} live={connected} />
    </div>
  );
}
