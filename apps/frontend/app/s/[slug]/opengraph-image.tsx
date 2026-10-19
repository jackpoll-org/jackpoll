import { resolveLinkApi } from "@/app/lib/survey/api";
import { OG_ALT, OG_SIZE, pageCard, previewSurvey, renderOgImage, surveyCard } from "@/app/lib/og/image";

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const survey = await previewSurvey(() => resolveLinkApi(slug));
  return renderOgImage(survey ? surveyCard(survey) : pageCard("brand"));
}
