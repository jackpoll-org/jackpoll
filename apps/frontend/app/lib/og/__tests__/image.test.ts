import { describe, expect, it } from "vitest";
import { previewSurvey, surveyMetadata } from "../image";
import { pageCard, surveyCard } from "../card";
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
    expect(card.ballot).toEqual({ question: "dropdown title", options: ["A", "B", "C", "D"], more: "+2 weitere", total: 6 });
    expect(card.meta).toEqual(["Umfrage", "2 Fragen", "ca. 1 Min."]);
    expect(card.style).toBe("classic");
    expect(card.cta).toBe("Jetzt teilnehmen");
    expect(card.accent).toBe("#ff0000");
  });

  it("keeps quiz questions off the image and uses the survey's language", () => {
    const card = surveyCard(survey({ isQuiz: true }, [question("multiple-choice", ["A"])], { languages: ["en"] }));
    expect(card.ballot).toBeUndefined();
    expect(card.meta).toEqual(["Quiz", "1 question", "~1 min"]);
  });

  it("drops the duration for host-paced live sessions and honours a label override", () => {
    expect(surveyCard(survey({ liveMode: true }, [question("rating")])).meta).toEqual(["Live", "1 Frage"]);
    const collab = surveyCard(survey({}, [], { defaultLanguage: "fr" }), "og.collab");
    expect(collab.meta).toEqual(["Zum Mitbearbeiten"]);
    expect(collab.cta).toBe("Mitbearbeiten");
  });
});

describe("link preview settings", () => {
  const base = { description: "Kurz und knapp", ownerName: "Ada" };

  it("shows title and description but hides the owner by default", () => {
    const card = surveyCard(survey({}, [], base));
    expect(card).toMatchObject({ title: "Team survey", description: "Kurz und knapp", owner: undefined });
  });

  it("honours the hide and show toggles", () => {
    const card = surveyCard(
      survey({ ogShowTitle: false, ogShowDescription: false, ogShowOwner: true }, [], base),
    );
    expect(card).toMatchObject({ title: "Umfragen und Quizze erstellen", description: undefined, owner: "von Ada" });
  });

  it("falls back to the given owner name until the server sends one", () => {
    expect(surveyCard(survey({ ogShowOwner: true }, []), undefined, "Grace").owner).toBe("von Grace");
    expect(surveyCard(survey({ ogShowOwner: true }, [])).owner).toBeUndefined();
    expect(surveyCard(survey({ ogShowOwner: true }, []), undefined, "$& Co").owner).toBe("von $& Co");
  });
});

describe("link preview design", () => {
  const ballotSurvey = (settings: Partial<SurveySettings>) =>
    survey(settings, [question("multiple-choice", ["A", "B"])]);

  it("uses the chosen design and falls back to classic for unknown values", () => {
    expect(surveyCard(ballotSurvey({ ogStyle: "spotlight" })).style).toBe("spotlight");
    expect(surveyCard(ballotSurvey({ ogStyle: "neon" as SurveySettings["ogStyle"] })).style).toBe("classic");
  });

  it("keeps the first question off the image when the owner hides it", () => {
    expect(surveyCard(ballotSurvey({})).ballot?.options).toEqual(["A", "B"]);
    expect(surveyCard(ballotSurvey({ ogShowQuestion: false })).ballot).toBeUndefined();
  });
});

describe("page previews", () => {
  it("uses the German page copy", () => {
    expect(pageCard("join")).toMatchObject({ title: "Mit Zugangscode teilnehmen", meta: [], cta: "Code eingeben" });
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
    expect(clamp("Dauert nur zwei Minuten – danke", 26)).toBe("Dauert nur zwei Minuten…");
  });

  it("strips emoji so rendering never needs the emoji CDN", () => {
    expect(clamp("🎉 Feedback 👍🏽 zum 🇩🇪 Workshop 1️⃣ ©", 40)).toBe("Feedback zum Workshop 1 ©");
  });
});
