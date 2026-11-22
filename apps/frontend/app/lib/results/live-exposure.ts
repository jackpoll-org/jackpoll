import type { Question, QuestionType } from "@/app/types/survey";
import { isAnswerable } from "@/app/lib/survey/content-block";
import { scoresOrder } from "@/app/lib/survey/grading";
import { inCombinedWordcloud } from "./combined-wordcloud";

const PRIVATE_TYPES = new Set<QuestionType>(["short-answer", "long-answer", "file-upload", "signature", "date"]);

export function liveExposable(question: Question, isQuiz: boolean, combined: boolean): boolean {
  if (combined && !inCombinedWordcloud(question, isQuiz)) return false;
  if (!isAnswerable(question.type) || PRIVATE_TYPES.has(question.type)) return false;
  if (isQuiz && scoresOrder(question)) return false;
  return question.showInLiveResults !== false;
}

export function widensExposure(before: Question, quizBefore: boolean, after: Question, quizAfter: boolean): boolean {
  return [false, true].some(
    (combined) => liveExposable(after, quizAfter, combined) && !liveExposable(before, quizBefore, combined),
  );
}
