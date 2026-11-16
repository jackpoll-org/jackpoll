import { Fragment, type ReactNode } from "react";
import { buildAllPages, type SurveyPage } from "@/app/lib/survey/pagination";
import type { AnswerValue } from "@/app/lib/survey/validation";
import type { AnswerInput, Question, Survey } from "@/app/types/survey";
import { ContentBlockCard } from "./content-block-card";

interface ResultPagesProps {
  survey: Survey;
  pages?: SurveyPage[];
  answers: AnswerInput[];
  renderQuestion: (question: Question) => ReactNode;
}

export function ResultPages({ survey, pages, answers, renderQuestion }: ResultPagesProps) {
  const values: Record<string, AnswerValue> = Object.fromEntries(
    answers.map((a) => [a.questionId, a.value as AnswerValue]),
  );
  return (pages ?? buildAllPages(survey)).map((page, index) => (
    <section key={index} className="grid gap-4">
      {(page.title || page.description) && (
        <div>
          {page.title && <h2 className="text-lg font-semibold">{page.title}</h2>}
          {page.description && (
            <p className="text-sm text-muted-foreground">{page.description}</p>
          )}
        </div>
      )}
      {page.questions.map((question) =>
        question.type === "content" ? (
          <ContentBlockCard
            key={question.id}
            question={question}
            answers={values}
            questions={survey.questions}
          />
        ) : (
          <Fragment key={question.id}>{renderQuestion(question)}</Fragment>
        ),
      )}
    </section>
  ));
}
