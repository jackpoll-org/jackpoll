import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import type { Survey } from "@/app/types/survey";

const mocks = vi.hoisted(() => ({
  submit: vi.fn(async () => ({ id: "r1", submittedAt: "x", answers: [] })),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.toastError } }));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: "en" }),
}));
vi.mock("@/app/hooks/survey", () => ({
  useSubmitResponse: () => ({ mutateAsync: mocks.submit, isPending: false }),
  useEditResponse: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSaveDraft: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteDraft: () => ({ mutateAsync: vi.fn(async () => undefined) }),
  useBeginToken: () => ({ data: undefined }),
}));

import { SurveyPlayer } from "../survey-player";

function survey(settings: Partial<Survey["settings"]>): Survey {
  return {
    id: "s1",
    title: "Vote",
    status: "published",
    settings,
    questions: [{ id: "q1", type: "short-answer", title: "Q1", required: false, order: 0 }],
  } as unknown as Survey;
}

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "common.submit" }));
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("SurveyPlayer respondent token", () => {
  it("requires the token before submitting and sends it trimmed", async () => {
    render(<SurveyPlayer survey={survey({ requireRespondentToken: true })} />);

    await submit();
    expect(mocks.toastError).toHaveBeenCalledWith("player.tokenRequired");
    expect(mocks.submit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/player.token/), { target: { value: " T-1 " } });
    await submit();
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ respondentToken: "T-1" }));
  });

  it("prefills the token read-only from the join link", () => {
    window.history.replaceState(null, "", "/s/abc?token=FromLink");
    render(<SurveyPlayer survey={survey({ requireRespondentToken: true })} />);

    const input = screen.getByLabelText(/player.token/);
    expect(input).toHaveValue("FromLink");
    expect(input).toHaveAttribute("readonly");
  });

  it("asks for no token when the survey does not require one", () => {
    render(<SurveyPlayer survey={survey({})} />);
    expect(screen.queryByLabelText(/player.token/)).toBeNull();
  });
});
