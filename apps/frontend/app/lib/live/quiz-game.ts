import type { SurveySettings } from "@/app/types/survey";

/**
 * A "Quiz game" is a live, presenter-paced quiz: the host drives the questions
 * one at a time (`liveMode`) and answers are scored (`isQuiz`). Created from the
 * "Quiz game" card on the dashboard, which presets both flags. Centralised here
 * so the builder, creation flow and live views agree on what a game is.
 */
export function isQuizGame(settings: Pick<SurveySettings, "isQuiz" | "liveMode">): boolean {
  return !!settings.isQuiz && !!settings.liveMode;
}

/** Default per-question countdown (seconds) seeded for a new Quiz game. */
export const QUIZ_GAME_DEFAULT_SECONDS = 20;

/** Answer slots a game question may offer (multiple-choice). */
export const QUIZ_GAME_MAX_OPTIONS = 4;
