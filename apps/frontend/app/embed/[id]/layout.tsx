import { cache } from "react";
import type { Metadata } from "next";
import { getPublicSurveyApi } from "@/app/lib/survey/api";
import { SURVEY_ENDPOINTS } from "@/app/lib/survey/constants";
import { previewSurvey, surveyMetadata } from "@/app/lib/og/image";
import { serverLocale, serverT } from "@/app/i18n/server";
import { SurveyNoscript } from "@/app/components/survey-player/survey-noscript";

const loadSurvey = cache((id: string) => previewSurvey(() => getPublicSurveyApi(id)));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return surveyMetadata(await loadSurvey(id), `/api${SURVEY_ENDPOINTS.publicDetail(id)}`);
}

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [survey, t, locale] = await Promise.all([loadSurvey(id), serverT(), serverLocale()]);
  return (
    <>
      <SurveyNoscript survey={survey} locale={locale} notice={t("player.noscript")} />
      {children}
    </>
  );
}
