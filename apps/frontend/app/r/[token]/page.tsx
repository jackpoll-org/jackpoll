"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { SurveyPlayer } from "@/app/components/survey-player/survey-player";
import { LanguageSwitcher } from "@/app/components/common/language-switcher";
import { useDraft, usePublicSurvey } from "@/app/hooks/survey";
import { Spinner } from "@/app/components/ui/spinner";
import { useTranslation } from "@/app/i18n/context";
import type { AnswerValue } from "@/app/lib/survey/validation";
import type { AnswerInput } from "@/app/types/survey";

/**
 * Resume page (issue #26): restores a saved draft by its token and reopens the
 * survey pre-filled with the saved answers. Works across devices.
 */
export default function ResumeDraftPage() {
  const params = useParams<{ token: string }>();
  const { t } = useTranslation();

  const draftQuery = useDraft(params.token);
  const draft = draftQuery.data;
  const surveyQuery = usePublicSurvey(draft?.surveyId);
  const survey = surveyQuery.data;

  const initialAnswers = useMemo(() => {
    if (!draft?.answers) return undefined;
    return draft.answers.reduce<Record<string, AnswerValue>>(
      (acc, a: AnswerInput) => {
        acc[a.questionId] = a.value as AnswerValue;
        return acc;
      },
      {},
    );
  }, [draft]);

  if (draftQuery.isLoading || (draft && surveyQuery.isLoading)) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  if (draftQuery.isError || !draft) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4 text-center">
        <p className="text-sm text-muted-foreground">{t("draft.expired")}</p>
      </div>
    );
  }

  if (surveyQuery.isError || !survey) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4 text-center">
        <p className="text-sm text-muted-foreground">
          {t("player.linkUnavailable")}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{t("draft.restored")}</p>
          <LanguageSwitcher withIcon />
        </div>
        <SurveyPlayer
          survey={survey}
          analytics
          initialAnswers={initialAnswers}
          initialDraftToken={draft.token}
        />
      </div>
    </div>
  );
}
