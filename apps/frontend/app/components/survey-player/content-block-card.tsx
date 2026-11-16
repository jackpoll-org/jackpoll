import { getQuestionTypeDefinition } from "@/app/components/question-types/registry";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { questionIds } from "@/app/lib/survey/a11y";
import { resolvePiping } from "@/app/lib/survey/piping";
import type { AnswerValue } from "@/app/lib/survey/validation";
import type { Question } from "@/app/types/survey";

interface ContentBlockCardProps {
  question: Question;
  answers: Record<string, AnswerValue>;
  questions: Question[];
}

export function ContentBlockCard({ question, answers, questions }: ContentBlockCardProps) {
  const { Preview } = getQuestionTypeDefinition("content");
  const resolved = {
    ...question,
    title: resolvePiping(question.title, answers, questions),
    description: resolvePiping(question.description, answers, questions),
  };
  const heading = resolved.title.trim();
  return (
    <Card id={questionIds(question.id).group}>
      {heading && (
        <CardHeader>
          <CardTitle className="text-base font-semibold">{heading}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <Preview question={resolved} />
      </CardContent>
    </Card>
  );
}
