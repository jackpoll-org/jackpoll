import { describe, expect, it } from "vitest";
import { pageCard, previewSurvey, surveyCard, surveyMetadata } from "../image";
import { clamp } from "../ballot";
import type { Question, Survey, SurveySettings } from "@/app/types/survey";

const question = (type: Question["type"], labels: string[] = []): Question => ({
  id: type,
  type,
  title: `${type} title`,
  required: false,
  order: 0,
  options: labels.map((label) => ({ id: label, label })),
});

const survey = (settings: Partial<SurveySettings>, questions: Question[], extra: Partial<Survey> = {}) =>
  ({
    id: "s1",
    ownerId: "o1",
    title: "Team survey",
    status: "published",
    settings: { isQuiz: false, ...settings },
    questions,
    createdAt: "",
    updatedAt: "",
    ...extra,
  }) as Survey;

describe("surveyCard", () => {
  it("puts the first choice question on the ballot and counts only real questions", () => {
    const card = surveyCard(
      survey({ accentColor: "#ff0000" }, [
        question("content"),
        question("short-answer"),
        question("dropdown", ["A", "", "B", "C", "D", "E", "F"]),
      ]),
    );
    expect(card.ballot).toEqual({ question: "dropdown title", options: ["A", "B", "C", "D"], more: "+2 weitere" });
    expect(card.meta).toBe("Umfrage · 2 Fragen · ca. 1 Min.");
    expect(card.accent).toBe("#ff0000");
  });

  it("keeps quiz questions off the image and uses the survey's language", () => {
    const card = surveyCard(survey({ isQuiz: true }, [question("multiple-choice", ["A"])], { languages: ["en"] }));
    expect(card.ballot).toBeUndefined();
    expect(card.meta).toBe("Quiz · 1 question · ~1 min");
  });

  it("drops the duration for host-paced live sessions and honours a label override", () => {
    expect(surveyCard(survey({ liveMode: true }, [question("rating")])).meta).toBe("Live · 1 Frage");
    expect(surveyCard(survey({}, [], { defaultLanguage: "fr" }), "og.collab").meta).toBe("Zum Mitbearbeiten");
  });
});

describe("page previews", () => {
  it("uses the German page copy", () => {
    expect(pageCard("join")).toMatchObject({ title: "Mit Zugangscode teilnehmen", meta: "" });
  });

  it("falls back to inherited metadata for unavailable surveys", async () => {
    await expect(previewSurvey(() => Promise.reject(new Error("404")))).resolves.toBeNull();
    expect(surveyMetadata(null)).toEqual({});
    expect(surveyMetadata(survey({}, []))).toEqual({ title: "Team survey", description: null });
  });
});

describe("clamp", () => {
  it("cuts at a word boundary", () => {
    expect(clamp("one two  three", 9)).toBe("one two…");
    expect(clamp("one two three", 7)).toBe("one two…");
    expect(clamp("short", 9)).toBe("short");
  });

  it("strips emoji so rendering never needs the emoji CDN", () => {
    expect(clamp("🎉 Feedback 👍🏽 zum 🇩🇪 Workshop 1️⃣ ©", 40)).toBe("Feedback zum Workshop 1 ©");
  });
});
