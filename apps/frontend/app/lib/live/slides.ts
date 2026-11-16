import type { Question, Survey } from "@/app/types/survey";
import { isAnswerable } from "@/app/lib/survey/content-block";
import { questionsInPageOrder } from "@/app/lib/survey/pagination";

/**
 * The slides a live session steps through, in order: every question plus
 * content blocks (public #7), which show as info slides between questions,
 * in the player's page order. Presenter, participants and the backend
 * (SurveyPages) must build this list the same way so the broadcast index
 * points at the same slide everywhere.
 */
export function liveSlides(survey: Survey): Question[] {
  return questionsInPageOrder(survey);
}

/** An info slide (content block): shown on the presenter, never answered or timed. */
export function isInfoSlide(slide: Question | undefined): boolean {
  return !!slide && !isAnswerable(slide.type);
}

/**
 * 1-based number of the answerable question at `index`, counting only real
 * questions (info slides don't count), plus the total question count.
 */
export function questionNumber(
  slides: Question[],
  index: number,
): { current: number; total: number } {
  const answerable = slides.map((s) => isAnswerable(s.type));
  return {
    current: answerable.slice(0, index + 1).filter(Boolean).length,
    total: answerable.filter(Boolean).length,
  };
}
