// Per-question result chart (public issues #1 and #2): which charts a question
// type can be shown as, which one it defaults to, and the owner's pick stored
// on the question as `settings.resultChart`. Shared by the results card, the
// live presenter view, the builder picker and the PDF export.

import type { TranslationKey } from "@/app/i18n/translations";
import type { Question } from "@/app/types/survey";

export type ChartType = "bar" | "pie" | "donut" | "line" | "wordcloud";

/** Display name of each chart, for the results switcher and builder picker. */
export const CHART_LABEL_KEY: Record<ChartType, TranslationKey> = {
  bar: "results.chart.bar",
  pie: "results.chart.pie",
  donut: "results.chart.donut",
  line: "results.chart.line",
  wordcloud: "results.chart.wordcloud",
};

/** The question settings key the builder writes the default chart to. */
export const RESULT_CHART_SETTING = "resultChart";

const CHOICE_CHARTS: readonly ChartType[] = ["bar", "pie", "donut", "wordcloud"];
// Ranking counts are weighted points (1st place scores most), not votes, so a
// word cloud would size options by something that isn't "how often picked".
const RANKING_CHARTS: readonly ChartType[] = ["bar", "pie", "donut"];
const SCALE_CHARTS: readonly ChartType[] = ["bar", "line"];

/** Charts a question type can be shown as; empty when it has no chart picker. */
export function allowedChartTypes(type: Question["type"]): ChartType[] {
  switch (type) {
    case "multiple-choice":
    case "dropdown":
    case "checkboxes":
      return [...CHOICE_CHARTS];
    case "ranking":
      return [...RANKING_CHARTS];
    case "slider":
    case "rating":
      return [...SCALE_CHARTS];
    default:
      return [];
  }
}

/** The chart a type opens with when the owner hasn't picked one. */
export function defaultChartType(type: Question["type"]): ChartType {
  // Single-select reads well as a pie; multi-select, ranking and scales as bars.
  return type === "multiple-choice" || type === "dropdown" ? "pie" : "bar";
}

/**
 * The chart to open a question's results with: the owner's configured pick when
 * the type allows it, otherwise the type default — so surveys created before
 * the setting existed (or with a stale/garbled value) render exactly as before.
 */
export function resolveResultChart(
  question: Pick<Question, "type" | "settings"> | undefined,
  fallbackType?: Question["type"],
): ChartType {
  const type = question?.type ?? fallbackType;
  if (!type) return "bar";
  const configured = question?.settings?.[RESULT_CHART_SETTING];
  const allowed = allowedChartTypes(type);
  return allowed.includes(configured as ChartType)
    ? (configured as ChartType)
    : defaultChartType(type);
}
