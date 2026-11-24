import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import type { Survey, SurveyResponseDto } from "@/app/types/survey";

const mocks = vi.hoisted(() => ({
  pending: false,
  submit: vi.fn(
    async (): Promise<Partial<SurveyResponseDto>> => ({ id: "r1", submittedAt: "x", answers: [] }),
  ),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: "en" }),
}));
vi.mock("@/app/hooks/survey", () => ({
  useSubmitResponse: () => ({ mutateAsync: mocks.submit, isPending: mocks.pending }),
  useEditResponse: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSaveDraft: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteDraft: () => ({ mutateAsync: vi.fn(async () => undefined) }),
  useBeginToken: () => ({ data: undefined }),
  useHasResponded: () => ({ data: undefined }),
}));

import { SurveyPlayer } from "../survey-player";

function survey(settings: Partial<Survey["settings"]>, multiPage = false): Survey {
  return {
    id: "s1",
    title: "Test",
    status: "published",
    settings: { disableSaveLater: true, ...settings },
    questions: [
      { id: "a", type: "short-answer", title: "A", required: false, order: 0, sectionId: multiPage ? "p1" : null },
      { id: "b", type: "short-answer", title: "B", required: false, order: 1, sectionId: multiPage ? "p2" : null },
    ],
    sections: multiPage
      ? [
          { id: "p1", title: "One", order: 0 },
          { id: "p2", title: "Two", order: 1 },
        ]
      : undefined,
  } as unknown as Survey;
}

async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

function expectInlineError(label: RegExp, message: string) {
  const input = screen.getByLabelText(label);
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(input).toHaveAccessibleDescription(message);
  expect(screen.getByRole("alert")).toHaveTextContent(message);
  expect(input).toHaveFocus();
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("SurveyPlayer respondent name and code", () => {
  it("keeps Next on page 1 until the name is entered", async () => {
    render(<SurveyPlayer survey={survey({ requireRespondentName: true }, true)} />);

    await click("common.next");
    expect(screen.getByText("One")).toBeTruthy();
    expectInlineError(/player.yourName/, "player.nameRequired");

    fireEvent.change(screen.getByLabelText(/player.yourName/), { target: { value: "Ada" } });
    expect(screen.queryByRole("alert")).toBeNull();
    await click("common.next");
    expect(screen.getByText("Two")).toBeTruthy();
  });

  it("keeps Next on page 1 until the participant code is entered", async () => {
    render(<SurveyPlayer survey={survey({ requireRespondentToken: true }, true)} />);

    await click("common.next");
    expect(screen.getByText("One")).toBeTruthy();
    expectInlineError(/player.token/, "player.tokenRequired");
  });

  it("shows the name error inline on a single-page submit", async () => {
    render(<SurveyPlayer survey={survey({ requireRespondentName: true })} />);

    await click("common.submit");
    expect(mocks.submit).not.toHaveBeenCalled();
    expectInlineError(/player.yourName/, "player.nameRequired");

    fireEvent.change(screen.getByLabelText(/player.yourName/), { target: { value: " Ada " } });
    await click("common.submit");
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ respondentName: "Ada" }));
  });

  it("asks for the name before the questions on a single-page submit", async () => {
    const s = survey({ requireRespondentName: true });
    s.questions[0].required = true;
    render(<SurveyPlayer survey={s} />);

    await click("common.submit");
    expectInlineError(/player.yourName/, "player.nameRequired");
  });
});

describe("SurveyPlayer timed quiz without a name", () => {
  it("submits once the name is filled in after the time ran out", async () => {
    vi.useFakeTimers();
    try {
      mocks.submit.mockClear();
      render(<SurveyPlayer survey={survey({ requireRespondentName: true, isQuiz: true, timeLimit: 1 })} analytics />);
      await act(async () => {
        vi.advanceTimersByTime(1100);
      });
      expect(mocks.submit).not.toHaveBeenCalled();
      const input = screen.getByLabelText(/player.yourName/);
      fireEvent.change(input, { target: { value: "Anna" } });
      await act(async () => {
        fireEvent.blur(input);
      });
      expect(mocks.submit).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not send a second response while the timed auto-submit is still pending", async () => {
    vi.useFakeTimers();
    try {
      mocks.submit.mockClear();
      mocks.submit.mockImplementationOnce(() => new Promise(() => {}));
      const quiz = survey({ requireRespondentName: true, isQuiz: true, timeLimit: 1 });
      const view = render(<SurveyPlayer survey={quiz} analytics />);
      const input = screen.getByLabelText(/player.yourName/);
      fireEvent.change(input, { target: { value: "Anna" } });
      await act(async () => {
        vi.advanceTimersByTime(1100);
      });
      expect(mocks.submit).toHaveBeenCalledTimes(1);
      mocks.pending = true;
      view.rerender(<SurveyPlayer survey={quiz} analytics />);
      await act(async () => {
        fireEvent.blur(screen.getByLabelText(/player.yourName/));
      });
      expect(mocks.submit).toHaveBeenCalledTimes(1);
    } finally {
      mocks.pending = false;
      vi.useRealTimers();
    }
  });
});
