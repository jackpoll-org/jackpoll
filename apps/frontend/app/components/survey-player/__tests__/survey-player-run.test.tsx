import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import type { Survey } from "@/app/types/survey";
import { ApiError } from "@/app/lib/survey/api";

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  toastError: vi.fn(),
  hasResponded: vi.fn<(...args: unknown[]) => { data: undefined }>(() => ({ data: undefined })),
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
  useHasResponded: (...args: unknown[]) => mocks.hasResponded(...args),
}));

import { SurveyPlayer } from "../survey-player";

const survey = {
  id: "s1",
  title: "Vote",
  status: "published",
  settings: {},
  questions: [{ id: "q1", type: "short-answer", title: "Q1", required: false, order: 0 }],
} as unknown as Survey;

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "common.submit" }));
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SurveyPlayer runs", () => {
  it("submits with the run id", async () => {
    mocks.submit.mockResolvedValue({ id: "r1", submittedAt: "x", answers: [] });
    render(<SurveyPlayer survey={survey} runId="run-1" />);
    await submit();
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ runId: "run-1" }));
  });

  it("hands a run conflict to the caller instead of a toast", async () => {
    mocks.submit.mockRejectedValue(new ApiError("RUN_REQUIRED", 409));
    const onRunError = vi.fn();
    render(<SurveyPlayer survey={survey} onRunError={onRunError} />);
    await submit();
    expect(onRunError).toHaveBeenCalledWith("RUN_REQUIRED", undefined);
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("treats a 403 NO_OPEN_RUN as not open and passes the next opening", async () => {
    mocks.submit.mockRejectedValue(
      new ApiError("Not open yet", 403, "NO_OPEN_RUN", undefined, "2027-01-01T08:00:00Z"),
    );
    const onRunError = vi.fn();
    render(<SurveyPlayer survey={survey} onRunError={onRunError} />);
    await submit();
    expect(onRunError).toHaveBeenCalledWith("NO_OPEN_RUN", "2027-01-01T08:00:00Z");
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("checks one-per-browser per run", () => {
    render(
      <SurveyPlayer
        survey={{ ...survey, settings: { onePerBrowser: true } } as Survey}
        analytics
        runId="run-1"
      />,
    );
    expect(mocks.hasResponded).toHaveBeenCalledWith("s1", expect.anything(), "run-1");
  });

  it("still toasts other errors", async () => {
    mocks.submit.mockRejectedValue(new ApiError("Nope", 400));
    render(<SurveyPlayer survey={survey} onRunError={vi.fn()} />);
    await submit();
    expect(mocks.toastError).toHaveBeenCalledWith("Nope");
  });
});
