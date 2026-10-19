import type { Metadata } from "next";
import { resolveCollabApi } from "@/app/lib/survey/api";
import { previewSurvey, surveyMetadata } from "@/app/lib/og/image";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return surveyMetadata(await previewSurvey(() => resolveCollabApi(slug)));
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
