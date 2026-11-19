"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { useTranslation } from "@/app/i18n/context";
import { combineWordclouds } from "@/app/lib/results/combined-wordcloud";
import type { Question, QuestionResult } from "@/app/types/survey";
import { WordcloudResult } from "./wordcloud-result";

interface CombinedWordcloudCardProps {
  questions: Question[];
  results: QuestionResult[];
  live?: boolean;
}

export function CombinedWordcloudCard({ questions, results, live }: CombinedWordcloudCardProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === "dark" ? "dark" : "light";
  const { words, legend } = useMemo(
    () => combineWordclouds(questions, results, mode),
    [questions, results, mode],
  );

  return (
    <Card data-testid="combined-wordcloud">
      <CardHeader>
        <CardTitle className="text-base font-medium">{t("wordcloud.combined.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <WordcloudResult
          words={words}
          countLabel={t("wordcloud.wordCount", { count: String(words.length) })}
          live={live}
          legend={
            <ul aria-label={t("wordcloud.combined.legend")} className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {legend.map((entry) => (
                <li key={entry.questionId} className="flex items-center gap-2">
                  <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                  {entry.title || t("player.untitledQuestion")}
                </li>
              ))}
            </ul>
          }
        />
      </CardContent>
    </Card>
  );
}
