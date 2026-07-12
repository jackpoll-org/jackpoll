"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { SurveyBuilder } from "@/app/components/survey-builder/survey-builder";
import { useSurvey } from "@/app/hooks/survey";
import { Spinner } from "@/app/components/ui/spinner";
import { Button } from "@/app/components/ui/button";
import { useTranslation } from "@/app/i18n/context";

function BuilderLoader() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const { data: survey, isLoading, isError, error } = useSurvey(params.id);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-32">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  if (isError || !survey) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-32 text-center">
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : t("builder.surveyNotFound")}
        </p>
        <Link href="/surveys">
          <Button variant="outline">{t("nav.backToSurveys")}</Button>
        </Link>
      </div>
    );
  }

  return <SurveyBuilder survey={survey} />;
}

export default function SurveyBuilderPage() {
  return <BuilderLoader />;
}
