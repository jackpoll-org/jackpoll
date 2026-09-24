"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { GradingView } from "@/app/components/survey-results/grading-view";

function GradingPageInner() {
  const params = useParams<{ id: string; responseId: string }>();
  const searchParams = useSearchParams();
  return (
    <GradingView
      surveyId={params.id}
      responseId={params.responseId}
      sessionId={searchParams.get("session")}
    />
  );
}

/** Grade one submission at a time (public #6). */
export default function GradeResponsePage() {
  return (
    <Suspense>
      <GradingPageInner />
    </Suspense>
  );
}
