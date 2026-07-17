import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { Survey } from "@/app/types/survey";

const updateSettings = vi.fn();
let survey: Survey;

vi.mock("../builder-context", () => ({
  useBuilder: () => ({ survey, updateSettings }),
}));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: "en" }),
}));
// Unrelated cards rendered by BuilderSettings — stub them out so this test
// only exercises the live-mode/quiz-mode toggles under test.
vi.mock("../outcomes-editor", () => ({ OutcomesEditor: () => null }));
vi.mock("../branding-card", () => ({ BrandingCard: () => null }));
vi.mock("../protection-card", () => ({ ProtectionCard: () => null }));
vi.mock("../retention-card", () => ({ RetentionCard: () => null }));
vi.mock("../respondent-privacy-card", () => ({ RespondentPrivacyCard: () => null }));
vi.mock("../notifications-card", () => ({ NotificationsCard: () => null }));
vi.mock("../integrations-card", () => ({ IntegrationsCard: () => null }));
vi.mock("../translations-card", () => ({ TranslationsCard: () => null }));

import { BuilderSettings } from "../builder-settings";

function baseSurvey(overrides: Partial<Survey["settings"]> = {}): Survey {
  return {
    id: "s1",
    ownerId: "owner-1",
    title: "Test",
    status: "draft",
    settings: {
      allowMultipleResponses: false,
      showProgressBar: false,
      shuffleQuestions: false,
      isQuiz: false,
      showLiveResults: false,
      postSubmitSummary: false,
      showPoweredBy: false,
      rateLimit: false,
      onePerBrowser: false,
      requireCaptcha: false,
      ...overrides,
    },
    questions: [],
    createdAt: "2026-06-10T00:00:00Z",
    updatedAt: "2026-06-10T00:00:00Z",
  };
}

beforeEach(() => {
  cleanup();
  updateSettings.mockClear();
});

describe("BuilderSettings live-quiz seconds persistence", () => {
  it("persists the default seconds when Live mode is turned on with Quiz mode already on", () => {
    survey = baseSurvey({ isQuiz: true, liveMode: false, liveQuestionSeconds: null });
    render(<BuilderSettings />);

    fireEvent.click(screen.getByRole("switch", { name: "builder.settings.liveMode" }));

    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ liveMode: true, liveQuestionSeconds: 20 }),
    );
  });

  it("persists the default seconds when Quiz mode is turned on with Live mode already on", () => {
    survey = baseSurvey({ isQuiz: false, liveMode: true, liveQuestionSeconds: null });
    render(<BuilderSettings />);

    fireEvent.click(screen.getByRole("switch", { name: "builder.settings.quizToggle" }));

    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ isQuiz: true, liveQuestionSeconds: 20 }),
    );
  });

  it("does not override an explicitly-set value (including 0)", () => {
    survey = baseSurvey({ isQuiz: true, liveMode: false, liveQuestionSeconds: 0 });
    render(<BuilderSettings />);

    fireEvent.click(screen.getByRole("switch", { name: "builder.settings.liveMode" }));

    const call = updateSettings.mock.calls[0][0];
    expect(call).not.toHaveProperty("liveQuestionSeconds");
  });

  it("does not touch seconds when the other flag is still off", () => {
    survey = baseSurvey({ isQuiz: false, liveMode: false, liveQuestionSeconds: null });
    render(<BuilderSettings />);

    fireEvent.click(screen.getByRole("switch", { name: "builder.settings.liveMode" }));

    const call = updateSettings.mock.calls[0][0];
    expect(call).not.toHaveProperty("liveQuestionSeconds");
  });
});
