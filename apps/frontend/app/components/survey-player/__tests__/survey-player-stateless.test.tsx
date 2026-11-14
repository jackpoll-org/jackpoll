import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import type { Survey, SurveyResponseDto } from "@/app/types/survey";

const mocks = vi.hoisted(() => ({
  submit: vi.fn(async (): Promise<Partial<SurveyResponseDto>> => ({ id: "r1", submittedAt: "x", answers: [] })),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/lib/survey/track", () => ({ trackEvent: vi.fn() }));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: "en" }),
}));
vi.mock("@/app/hooks/survey", () => ({
  useSubmitResponse: () => ({ mutateAsync: mocks.submit, isPending: false }),
  useEditResponse: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSaveDraft: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteDraft: () => ({ mutateAsync: vi.fn(async () => undefined) }),
  useBeginToken: () => ({ data: undefined }),
  useHasResponded: () => ({ data: undefined }),
}));

import { SurveyPlayer } from "../survey-player";

function survey(settings: Partial<Survey["settings"]>): Survey {
  return {
    id: "s1",
    title: "Quiz",
    status: "published",
    settings: { isQuiz: true, ...settings },
    questions: [
      {
        id: "q1",
        type: "multiple-choice",
        title: "Capital of France?",
        required: false,
        order: 0,
        options: [
          { id: "paris", label: "Paris" },
          { id: "rome", label: "Rome" },
        ],
      },
      { id: "q2", type: "short-answer", title: "2+2?", required: false, order: 1 },
    ],
  } as unknown as Survey;
}

function answerRome() {
  fireEvent.click(screen.getByLabelText("Rome"));
}

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "common.submit" }));
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("SurveyPlayer save for later", () => {
  it("offers save for later and autosaves by default", () => {
    render(<SurveyPlayer survey={survey({})} analytics />);
    answerRome();
    expect(screen.getByRole("button", { name: /draft.saveLater/ })).toBeTruthy();
    expect(window.localStorage.getItem("survey-draft:s1")).not.toBeNull();
  });

  it.each([{ disableSaveLater: true }, { doNotStoreResponses: true }])(
    "hides save for later and keeps nothing in the browser with %o",
    (settings) => {
      window.localStorage.setItem(
        "survey-draft:s1",
        JSON.stringify({ answers: { q2: "old" }, savedAt: 1 }),
      );
      render(<SurveyPlayer survey={survey(settings)} analytics />);
      expect(screen.getByRole("textbox")).toHaveValue("");
      expect(window.localStorage.getItem("survey-draft:s1")).toBeNull();
      answerRome();
      expect(screen.queryByRole("button", { name: /draft.saveLater/ })).toBeNull();
      expect(screen.queryByText("draft.saved")).toBeNull();
      expect(window.localStorage.getItem("survey-draft:s1")).toBeNull();
    },
  );
});

describe("SurveyPlayer corrections", () => {
  it("lists each scored answer with the correct answer after submitting", async () => {
    mocks.submit.mockResolvedValueOnce({
      id: "r1",
      submittedAt: "x",
      answers: [],
      score: 1,
      maxScore: 3,
      corrections: [
        { questionId: "q1", answer: "rome", correct: false, points: 0, maxPoints: 2, correctAnswers: ["paris"] },
        { questionId: "q2", answer: "Four", correct: true, points: 1, maxPoints: 1, correctAnswers: ["4", "four"] },
      ],
    });
    render(<SurveyPlayer survey={survey({})} analytics />);
    answerRome();
    await submit();

    const first = screen.getByTestId("correction-q1");
    expect(first).toHaveTextContent("Capital of France?");
    expect(first).toHaveTextContent("Rome");
    expect(first).toHaveTextContent("Paris");
    expect(first).toHaveTextContent("0 / 2");
    expect(first).toHaveTextContent("player.incorrect");
    const second = screen.getByTestId("correction-q2");
    expect(second).toHaveTextContent("Four");
    expect(second).toHaveTextContent("player.correct");
    expect(second).not.toHaveTextContent("player.correctAnswer");
  });

  it("leaves out questions the participant never saw", async () => {
    mocks.submit.mockResolvedValueOnce({
      id: "r1",
      submittedAt: "x",
      answers: [],
      corrections: [
        { questionId: "q1", answer: "rome", correct: false, points: 0, maxPoints: 2, correctAnswers: ["paris"] },
        { questionId: "q3", correct: false, points: 0, maxPoints: 1, correctAnswers: ["yes"] },
      ],
    });
    const s = survey({});
    s.questions.push({
      id: "q3",
      type: "short-answer",
      title: "Only for Paris",
      required: false,
      order: 2,
      settings: { logic: { match: "all", conditions: [{ questionId: "q1", operator: "equals", value: "paris" }] } },
    } as Survey["questions"][number]);
    render(<SurveyPlayer survey={s} analytics />);
    answerRome();
    await submit();

    expect(screen.getByTestId("correction-q1")).toBeTruthy();
    expect(screen.queryByTestId("correction-q3")).toBeNull();
    const sent = (mocks.submit.mock.calls.at(-1) as unknown as [{ shownQuestionIds: string[] }])[0];
    expect(sent.shownQuestionIds).toContain("q1");
    expect(sent.shownQuestionIds).not.toContain("q3");
  });

  it("shows no corrections when the server sends none", async () => {
    render(<SurveyPlayer survey={survey({})} analytics />);
    await submit();
    expect(screen.queryByTestId("correction-q1")).toBeNull();
  });
});
