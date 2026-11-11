import { cache } from "react";
import type { Metadata } from "next";
import { resolveLinkApi } from "@/app/lib/survey/api";
import { SURVEY_ENDPOINTS } from "@/app/lib/survey/constants";
import { previewSurvey, surveyMetadata } from "@/app/lib/og/image";
import { serverLocale, serverT } from "@/app/i18n/server";
import { SurveyNoscript } from "@/app/components/survey-player/survey-noscript";

const loadSurvey = cache((slug: string) => previewSurvey(() => resolveLinkApi(slug)));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return surveyMetadata(await loadSurvey(slug), `/api${SURVEY_ENDPOINTS.publicLink(slug)}`);
}

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [survey, t, locale] = await Promise.all([loadSurvey(slug), serverT(), serverLocale()]);
  return (
    <>
      <SurveyNoscript survey={survey} locale={locale} notice={t("player.noscript")} />
      {children}
    </>
  );
}
