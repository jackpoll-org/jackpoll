"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateResponseData } from "@/app/hooks/survey";
import { surveyKeys } from "@/app/lib/survey/constants";
import { ResultsLiveSocket, liveResultsEnabled } from "@/app/lib/results/live-socket";
import { mergeWordcloudDeltas, parseResultsMessage } from "@/app/lib/results/merge";
import type { SurveyResults } from "@/app/types/survey";

/**
 * Open a live-results WebSocket for a survey and update the aggregated counts
 * whenever a new response is submitted (wordcloud / presentation mode). When the
 * message carries wordcloud deltas, they are merged into the cached results
 * in-place (no refetch roundtrip); a bare "updated" ping triggers a refetch.
 * When live push is disabled or the socket can't connect, the existing results
 * polling remains the fallback, so data still updates — just slower.
 */
export function useLiveResultsSocket(
  surveyId: string | undefined,
  enabled = true,
): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!surveyId || !enabled || !liveResultsEnabled()) return;
    const socket = new ResultsLiveSocket(surveyId, (data) => {
      const message = parseResultsMessage(data);
      if (!message) {
        // Plain ping → refetch (covers non-wordcloud questions and the
        // live-disabled case where deltas aren't pushed).
        invalidateResponseData(queryClient, surveyId);
        return;
      }
      // Merge the delta into both the owner and public live-results caches.
      const merge = (old: SurveyResults | undefined) =>
        old ? mergeWordcloudDeltas(old, message.deltas) : old;
      queryClient.setQueryData(surveyKeys.results(surveyId), merge);
      queryClient.setQueryData(surveyKeys.liveResults(surveyId), merge);
    });
    return () => socket.destroy();
  }, [surveyId, enabled, queryClient]);
}
