import { describe, it, expect } from "vitest";
import { pdfChartFor, wordcloudFor } from "../pdf-export";
import type { Question, QuestionResult, Survey } from "@/app/types/survey";

const choice = {
  id: "q1",
  type: "multiple-choice",
  title: "Which word describes us?",
  required: false,
  order: 0,
  options: [
    { id: "a", label: "Simple" },
    { id: "b", label: "Fast" },
    { id: "c", label: "Modern" },
  ],
} as Question;

const cloudQuestion = { id: "q2", type: "wordcloud", title: "Words", required: false, order: 1 } as Question;

const survey = { questions: [choice, cloudQuestion] } as Survey;

function result(q: Question, optionCounts: Record<string, number>): QuestionResult {
  return { questionId: q.id, type: q.type, title: q.title, answered: 7, optionCounts } as QuestionResult;
}

describe("wordcloudFor", () => {
  it("draws a choice question picked as a word cloud with its option labels, relative sizing", () => {
    expect(wordcloudFor(survey, result(choice, { a: 3, b: 2, c: 0 }), "wordcloud")).toEqual({
      words: [
        { text: "Simple", value: 3 },
        { text: "Fast", value: 2 },
      ],
      scale: "relative",
    });
  });

  it("leaves choice questions on other charts alone", () => {
    expect(wordcloudFor(survey, result(choice, { a: 3 }), "pie")).toBeNull();
  });

  it("always draws the wordcloud question type as a cloud, on the absolute scale", () => {
    expect(wordcloudFor(survey, result(cloudQuestion, { great: 2, ok: 1 }), "bar")).toEqual({
      words: [
        { text: "great", value: 2 },
        { text: "ok", value: 1 },
      ],
      scale: "absolute",
    });
  });

  it("falls back (null) when nobody picked anything", () => {
    expect(wordcloudFor(survey, result(choice, { a: 0 }), "wordcloud")).toBeNull();
  });
});

describe("pdfChartFor", () => {
  it("uses the chart picked on screen", () => {
    expect(pdfChartFor(survey, result(choice, {}), { q1: "bar" })).toBe("bar");
  });

  it("falls back to the question's configured default, not always bars", () => {
    const configured = {
      questions: [{ ...choice, settings: { resultChart: "wordcloud" } }],
    } as unknown as Survey;
    expect(pdfChartFor(configured, result(choice, {}), undefined)).toBe("wordcloud");
    expect(pdfChartFor(survey, result(choice, {}), {})).toBe("pie");
  });
});
