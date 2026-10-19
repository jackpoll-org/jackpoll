import { getPublicSurveyApi } from "@/app/lib/survey/api";
import { OG_ALT, OG_SIZE, pageCard, previewSurvey, renderOgImage, surveyCard } from "@/app/lib/og/image";

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const survey = await previewSurvey(() => getPublicSurveyApi(id));
  return renderOgImage(survey ? surveyCard(survey) : pageCard("brand"));
}
