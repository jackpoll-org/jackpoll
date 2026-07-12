"use client";

import { useParams } from "next/navigation";
import { PresenterView } from "@/app/components/live/presenter-view";

/** Presenter-paced live view for a survey (#). */
export default function PresentPage() {
  const params = useParams<{ id: string }>();
  return <PresenterView surveyId={params.id} />;
}
