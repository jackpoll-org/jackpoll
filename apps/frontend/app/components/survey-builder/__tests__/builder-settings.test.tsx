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
vi.mock("../og-preview-card", () => ({ OgPreviewCard: () => null }));
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

describe("BuilderSettings response storage", () => {
  const storeSwitch = () =>
    screen.getByRole("switch", { name: "builder.settings.doNotStoreResponses" });
  const saveLaterSwitch = () =>
    screen.getByRole("switch", { name: "builder.settings.allowSaveLater" });

  it("toggles save for later, on by default", () => {
    survey = baseSurvey();
    render(<BuilderSettings />);

    expect(saveLaterSwitch()).toBeChecked();
    fireEvent.click(saveLaterSwitch());
    expect(updateSettings).toHaveBeenCalledWith({ disableSaveLater: true });
  });

  it("turns on not storing responses when nothing needs them", () => {
    survey = baseSurvey({ isQuiz: true });
    render(<BuilderSettings />);

    fireEvent.click(storeSwitch());
    expect(updateSettings).toHaveBeenCalledWith({ doNotStoreResponses: true });
  });

  it("blocks not storing responses while a setting needs them", () => {
    survey = baseSurvey({ isQuiz: true, allowEditResponses: true });
    render(<BuilderSettings />);

    expect(storeSwitch()).toBeDisabled();
    expect(screen.getByText("builder.settings.doNotStoreConflictSettings")).toBeTruthy();
  });

  it("locks settings that need stored responses once it is on", () => {
    survey = baseSurvey({ isQuiz: true, doNotStoreResponses: true });
    render(<BuilderSettings />);

    expect(screen.getByRole("switch", { name: "builder.settings.liveMode" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "builder.settings.allowEdit" })).toBeDisabled();
    expect(saveLaterSwitch()).toBeDisabled();
    expect(saveLaterSwitch()).not.toBeChecked();
  });
});

describe("BuilderSettings combined word cloud hints", () => {
  const cloud = { id: "q1", type: "wordcloud", title: "Hopes", required: false, order: 0 } as Survey["questions"][number];

  function renderWith(settings: Partial<Survey["settings"]>, questions: Survey["questions"]) {
    survey = { ...baseSurvey({ postSubmitCombinedWordcloud: true, ...settings }), questions };
    render(<BuilderSettings />);
  }

  it("warns when the survey has no word-cloud question", () => {
    renderWith({}, []);
    expect(screen.getByText("builder.settings.combinedWordcloudNoQuestion")).toBeTruthy();
  });

  it("warns when every word-cloud question is hidden from live results", () => {
    renderWith({}, [{ ...cloud, showInLiveResults: false }]);
    expect(screen.getByText("builder.settings.combinedWordcloudHidden")).toBeTruthy();
  });

  it("counts a choice question shown as a word cloud", () => {
    const choice = {
      id: "c1",
      type: "multiple-choice",
      title: "Pick",
      required: false,
      order: 1,
      settings: { resultChart: "wordcloud" },
      options: [],
    } as unknown as Survey["questions"][number];
    renderWith({}, [choice]);
    expect(screen.queryByText(/builder\.settings\.combinedWordcloud(NoQuestion|Hidden|LiveMode)/)).toBeNull();
    cleanup();
    renderWith({}, [{ ...choice, showInLiveResults: false }]);
    expect(screen.getByText("builder.settings.combinedWordcloudHidden")).toBeTruthy();
    cleanup();
    renderWith({}, [{ ...choice, settings: { resultChart: "pie" } }]);
    expect(screen.getByText("builder.settings.combinedWordcloudNoQuestion")).toBeTruthy();
  });

  it("does not count a scored quiz choice question shown as a word cloud", () => {
    const choice = {
      id: "c1", type: "multiple-choice", title: "Pick", required: false, order: 1,
      settings: { resultChart: "wordcloud" }, options: [{ id: "o1", label: "A" }], correctAnswers: ["o1"],
    } as unknown as Survey["questions"][number];
    renderWith({ isQuiz: true }, [choice]);
    expect(screen.getByText("builder.settings.combinedWordcloudNoQuestion")).toBeTruthy();
    cleanup();
    renderWith({ isQuiz: true }, [{ ...choice, settings: { resultChart: "wordcloud", poll: true } }]);
    expect(screen.queryByText(/builder\.settings\.combinedWordcloud(NoQuestion|Hidden|LiveMode)/)).toBeNull();
  });

  it("warns that live mode replaces the confirmation page", () => {
    renderWith({ liveMode: true }, [cloud]);
    expect(screen.getByText("builder.settings.combinedWordcloudLiveMode")).toBeTruthy();
  });

  it("shows no hint when a visible word-cloud question exists or the setting is off", () => {
    renderWith({}, [cloud]);
    expect(screen.queryByText(/builder\.settings\.combinedWordcloud(NoQuestion|Hidden|LiveMode)/)).toBeNull();
    cleanup();
    renderWith({ postSubmitCombinedWordcloud: false }, []);
    expect(screen.queryByText("builder.settings.combinedWordcloudNoQuestion")).toBeNull();
  });
});
