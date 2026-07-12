"use client";

import { useLiveResults } from "@/app/hooks/survey";
import { useLiveResultsSocket } from "@/app/hooks/results-live";
import { Spinner } from "@/app/components/ui/spinner";
import { QuestionResultCard } from "@/app/components/survey-results/question-result-card";
import type { Survey } from "@/app/types/survey";
import { useTranslation } from "@/app/i18n/context";

/** Post-submit live results summary shown to respondents (issue #21). */
export function LiveResultsSummary({ survey }: { survey: Survey }) {
  const { t } = useTranslation();
  const live = useLiveResults(survey.id, true);
  // Push updates so the cloud grows live as others submit.
  useLiveResultsSocket(survey.id);

  if (live.isLoading) {
    return <Spinner className="size-5" />;
  }
  if (live.isError || !live.data || live.data.questions.length === 0) {
    return null;
  }

  const questionById = new Map(survey.questions.map((q) => [q.id, q]));

  return (
    <div className="grid w-full gap-3 text-left">
      <div>
        <h3 className="text-base font-medium">{t("live.title")}</h3>
        {live.data.totalResponses < 5 && (
          <p className="text-xs text-muted-foreground">
            {live.data.totalResponses === 1
              ? t("live.basedOnOne", { count: String(live.data.totalResponses) })
              : t("live.basedOnMany", { count: String(live.data.totalResponses) })}
          </p>
        )}
      </div>
      {live.data.questions.map((result) => (
        <QuestionResultCard
          key={result.questionId}
          result={result}
          question={questionById.get(result.questionId)}
        />
      ))}
    </div>
  );
}
