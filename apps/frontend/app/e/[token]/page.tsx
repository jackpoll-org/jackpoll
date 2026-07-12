"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { SurveyPlayer } from "@/app/components/survey-player/survey-player";
import { LanguageSwitcher } from "@/app/components/common/language-switcher";
import { useResponseForEdit, usePublicSurvey } from "@/app/hooks/survey";
import { Spinner } from "@/app/components/ui/spinner";
import { useTranslation } from "@/app/i18n/context";
import type { AnswerValue } from "@/app/lib/survey/validation";
import type { AnswerInput } from "@/app/types/survey";

/**
 * Edit-after-submission page (issue #40): re-opens an already submitted response
 * by its edit token, pre-filled with the previous answers. Saving updates the
 * same response in place (no duplicate, results stay accurate).
 */
export default function EditResponsePage() {
  const params = useParams<{ token: string }>();
  const { t } = useTranslation();

  const editQuery = useResponseForEdit(params.token);
  const edit = editQuery.data;
  const surveyQuery = usePublicSurvey(edit?.surveyId);
  const survey = surveyQuery.data;

  const initialAnswers = useMemo(() => {
    if (!edit?.response.answers) return undefined;
    return edit.response.answers.reduce<Record<string, AnswerValue>>(
      (acc, a: AnswerInput) => {
        acc[a.questionId] = a.value as AnswerValue;
        return acc;
      },
      {},
    );
  }, [edit]);

  if (editQuery.isLoading || (edit && surveyQuery.isLoading)) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  if (editQuery.isError || !edit) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4 text-center">
        <p className="text-sm text-muted-foreground">{t("edit.linkUnavailable")}</p>
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
          <p className="text-sm text-muted-foreground">{t("edit.editing")}</p>
          <LanguageSwitcher withIcon />
        </div>
        <SurveyPlayer
          survey={survey}
          initialAnswers={initialAnswers}
          editToken={params.token}
        />
      </div>
    </div>
  );
}
