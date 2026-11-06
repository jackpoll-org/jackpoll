"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { QuestionGradingView } from "@/app/components/survey-results/question-grading-view";

function QuestionGradingPageInner() {
  const params = useParams<{ id: string; questionId: string }>();
  const searchParams = useSearchParams();
  return (
    <QuestionGradingView
      surveyId={params.id}
      questionId={params.questionId}
      sessionId={searchParams.get("session")}
    />
  );
}

export default function GradeQuestionPage() {
  return (
    <Suspense>
      <QuestionGradingPageInner />
    </Suspense>
  );
}
