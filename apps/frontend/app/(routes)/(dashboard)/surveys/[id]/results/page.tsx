"use client";

import { useParams } from "next/navigation";
import { ResultsDashboard } from "@/app/components/survey-results/results-dashboard";

export default function SurveyResultsPage() {
  const params = useParams<{ id: string }>();
  return <ResultsDashboard surveyId={params.id} />;
}
