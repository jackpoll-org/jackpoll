import { Suspense } from "react";
import { SurveyDashboard } from "@/app/components/survey-dashboard/survey-dashboard";

export default function SurveysPage() {
  return (
    <Suspense>
      <SurveyDashboard />
    </Suspense>
  );
}
