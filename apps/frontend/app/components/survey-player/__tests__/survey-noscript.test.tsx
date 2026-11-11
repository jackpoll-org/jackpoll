import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Survey } from "@/app/types/survey";
import { SurveyNoscript } from "../survey-noscript";

const survey = {
  id: "s1",
  title: "Team feedback",
  description: "Tell us how it went",
  settings: {},
  sections: [
    { id: "b", order: 1, title: "Second" },
    { id: "a", order: 0, title: "First" },
  ],
  questions: [
    { id: "q0", type: "short-answer", title: "Your name", required: false, order: 5, sectionId: null },
    { id: "q2", type: "short-answer", title: "Anything else?", required: false, order: 0, sectionId: "b" },
    {
      id: "q1",
      type: "multiple-choice",
      title: "Capital of France?",
      required: true,
      order: 0,
      sectionId: "a",
      options: [
        { id: "o1", label: "Paris" },
        { id: "o2", label: "Lyon" },
      ],
      correctAnswers: ["SECRET-ANSWER"],
    },
  ],
} as unknown as Survey;

describe("SurveyNoscript", () => {
  it("renders nothing without a public survey", () => {
    expect(renderToStaticMarkup(<SurveyNoscript survey={null} locale="en" notice="n" />)).toBe("");
  });

  it("renders title, description and questions in survey order", () => {
    const html = renderToStaticMarkup(<SurveyNoscript survey={survey} locale="en" notice="Turn on JavaScript" />);
    expect(html).toContain("<noscript>");
    expect(html).toContain("Team feedback");
    expect(html).toContain("Tell us how it went");
    expect(html).toContain("<li>Paris</li>");
    expect(html.indexOf("Your name")).toBeLessThan(html.indexOf("Capital of France?"));
    expect(html.indexOf("Capital of France?")).toBeLessThan(html.indexOf("Anything else?"));
    expect(html).toContain("Turn on JavaScript");
  });

  it("keeps the authored order in a conversational survey, like the player", () => {
    const conversational = { ...survey, settings: { conversational: true } } as unknown as Survey;
    const html = renderToStaticMarkup(<SurveyNoscript survey={conversational} locale="en" notice="" />);
    expect(html.indexOf("Anything else?")).toBeLessThan(html.indexOf("Capital of France?"));
  });

  it("drops questions of a missing section, like the player", () => {
    const orphaned = {
      ...survey,
      questions: [...survey.questions, { id: "qx", type: "short-answer", title: "Orphan", order: 9, sectionId: "gone" }],
    } as unknown as Survey;
    expect(renderToStaticMarkup(<SurveyNoscript survey={orphaned} locale="en" notice="" />)).not.toContain("Orphan");
    const unsectioned = { ...orphaned, sections: [] } as unknown as Survey;
    expect(renderToStaticMarkup(<SurveyNoscript survey={unsectioned} locale="en" notice="" />)).toContain("Orphan");
  });

  it("shows the survey's translation for the visitor's language", () => {
    const translated = {
      ...survey,
      languages: ["en", "de"],
      defaultLanguage: "en",
      i18n: { de: { title: "Team-Feedback" } },
    } as unknown as Survey;
    expect(renderToStaticMarkup(<SurveyNoscript survey={translated} locale="de" notice="" />)).toContain("Team-Feedback");
  });

  it("never exposes quiz answers", () => {
    expect(renderToStaticMarkup(<SurveyNoscript survey={survey} locale="en" notice="" />)).not.toContain("SECRET-ANSWER");
  });
});
