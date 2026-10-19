import type { Metadata } from "next";
import { getPublicSurveyApi } from "@/app/lib/survey/api";
import { previewSurvey, surveyMetadata } from "@/app/lib/og/image";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return surveyMetadata(await previewSurvey(() => getPublicSurveyApi(id)));
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
