import { describe, expect, it } from "vitest";
import {
  defaultLanguageOf,
  fieldKeys,
  getTranslation,
  isMultilingual,
  localizeSurvey,
  resolveContentLocale,
} from "@/app/lib/survey/content-i18n";
import type { Survey } from "@/app/types/survey";

function makeSurvey(overrides: Partial<Survey> = {}): Survey {
  return {
    id: "s1",
    ownerId: "o1",
    title: "Feedback",
    description: "Help us improve",
    status: "published",
    settings: {
      allowMultipleResponses: true,
      showProgressBar: true,
      shuffleQuestions: false,
      isQuiz: false,
      showLiveResults: false,
      postSubmitSummary: false,
      showPoweredBy: true,
      rateLimit: false,
      onePerBrowser: false,
      requireCaptcha: false,
      confirmationMessage: "Thanks!",
    },
    questions: [
      {
        id: "q1",
        type: "multiple-choice",
        title: "Your name?",
        required: true,
        order: 0,
        options: [
          { id: "o1", label: "Yes" },
          { id: "o2", label: "No" },
        ],
      },
    ],
    sections: [{ id: "sec1", title: "Intro", order: 0 }],
    languages: ["en", "de"],
    defaultLanguage: "en",
    i18n: {
      de: {
        [fieldKeys.surveyTitle]: "Rückmeldung",
        [fieldKeys.confirmationMessage]: "Danke!",
        [fieldKeys.questionTitle("q1")]: "Dein Name?",
        [fieldKeys.optionLabel("o1")]: "Ja",
        [fieldKeys.sectionTitle("sec1")]: "Einleitung",
      },
    },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("content-i18n", () => {
  it("detects multilingual + default language", () => {
    const s = makeSurvey();
    expect(isMultilingual(s)).toBe(true);
    expect(defaultLanguageOf(s)).toBe("en");
    expect(isMultilingual(makeSurvey({ languages: ["en"] }))).toBe(false);
  });

  it("resolves requested locale, falling back to default", () => {
    const s = makeSurvey();
    expect(resolveContentLocale(s, "de")).toBe("de");
    expect(resolveContentLocale(s, "fr")).toBe("en");
    expect(resolveContentLocale(s, undefined)).toBe("en");
  });

  it("reads translations, blank/missing return undefined", () => {
    const s = makeSurvey();
    expect(getTranslation(s, "de", fieldKeys.surveyTitle)).toBe("Rückmeldung");
    expect(getTranslation(s, "de", fieldKeys.surveyDescription)).toBeUndefined();
    expect(getTranslation(s, "fr", fieldKeys.surveyTitle)).toBeUndefined();
  });

  it("localizes content while keeping ids and falling back per field", () => {
    const de = localizeSurvey(makeSurvey(), "de");
    expect(de.title).toBe("Rückmeldung");
    // No German description translation → canonical English kept.
    expect(de.description).toBe("Help us improve");
    expect(de.settings.confirmationMessage).toBe("Danke!");
    expect(de.questions[0].id).toBe("q1");
    expect(de.questions[0].title).toBe("Dein Name?");
    expect(de.questions[0].options![0].label).toBe("Ja");
    // Untranslated option falls back to canonical.
    expect(de.questions[0].options![1].label).toBe("No");
    expect(de.sections![0].title).toBe("Einleitung");
  });

  it("returns the original survey for the default language", () => {
    const s = makeSurvey();
    expect(localizeSurvey(s, "en")).toBe(s);
  });
});
