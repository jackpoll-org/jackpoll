import type { Question } from "@/app/types/survey";
import { isAnswerable } from "@/app/lib/survey/content-block";

/**
 * The slides a live session steps through, in order: every question plus
 * content blocks (public #7), which show as info slides between questions.
 * Presenter and participants must build this list the same way so the
 * broadcast index points at the same slide on every device.
 */
export function liveSlides(questions: Question[]): Question[] {
  return questions.toSorted((a, b) => a.order - b.order);
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
