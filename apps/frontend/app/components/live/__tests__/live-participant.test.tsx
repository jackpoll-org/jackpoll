import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";
import type { Survey } from "@/app/types/survey";

const mocks = vi.hoisted(() => ({
  submit: vi.fn(async () => ({})),
  liveScore: vi.fn(
    async (): Promise<{ success: boolean; data?: { score: number | null }; error?: string }> => ({
      success: true,
      data: { score: 100 },
    }),
  ),
  join: vi.fn(),
  presence: null as null | ((state: { index: number; phase: string }) => void),
}));

vi.mock("@/app/i18n/context", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock("@/app/hooks/survey", () => ({
  useBeginToken: () => ({ data: "begin" }),
  useSubmitResponse: () => ({ mutateAsync: mocks.submit, isPending: false }),
}));
vi.mock("@/app/hooks/live", () => ({
  useCountdown: () => null,
  useCountdownFraction: () => 1,
  useJoinLive: () => ({ mutate: mocks.join }),
  useLivePresence: (_id: string, _on: boolean, cb: typeof mocks.presence) => {
    mocks.presence = cb;
  },
}));
vi.mock("@/app/lib/survey/api", () => ({
  altchaChallengeUrl: () => "",
  getLiveScoreApi: mocks.liveScore,
}));
vi.mock("@/app/lib/live/sound", () => ({
  playCorrect: vi.fn(),
  playTick: vi.fn(),
  playWrong: vi.fn(),
}));
vi.mock("@/app/components/question-types/registry", () => ({
  getQuestionTypeDefinition: () => ({
    Preview: ({ onChange }: { onChange: (v: string) => void }) => (
      <input aria-label="answer" onChange={(e) => onChange(e.target.value)} />
    ),
  }),
}));

import { LiveParticipant } from "../live-participant";

function survey(settings: Partial<Survey["settings"]>): Survey {
  return {
    id: "s1",
    title: "Live",
    settings: { liveMode: true, ...settings },
    questions: [{ id: "q1", type: "short-answer", title: "Q1", required: false, order: 0 }],
  } as unknown as Survey;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LiveParticipant", () => {
  it("asks a late joiner for the required name before the current question (#15)", async () => {
    render(<LiveParticipant survey={survey({ requireRespondentName: true })} />);
    act(() => mocks.presence?.({ index: 0, phase: "question" }));

    expect(screen.queryByText("Q1")).toBeNull();
    fireEvent.change(screen.getByLabelText("player.yourName"), { target: { value: " Ada " } });
    fireEvent.click(screen.getByRole("button", { name: "live.join" }));

    fireEvent.change(screen.getByLabelText("answer"), { target: { value: "hi" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "live.submitAnswer" }));
    });
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ respondentName: "Ada" }));
  });

  it("learns its points only once the presenter reveals the answer", async () => {
    render(<LiveParticipant survey={survey({ isQuiz: true })} />);
    fireEvent.change(screen.getByLabelText("player.yourName"), { target: { value: "Ada" } });
    fireEvent.click(screen.getByRole("button", { name: "live.join" }));
    act(() => mocks.presence?.({ index: 0, phase: "question" }));

    fireEvent.change(screen.getByLabelText("answer"), { target: { value: "hi" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "live.submitAnswer" }));
    });
    expect(mocks.liveScore).not.toHaveBeenCalled();

    await act(async () => mocks.presence?.({ index: 0, phase: "reveal" }));
    await waitFor(() => expect(screen.getByText("live.correct")).toBeTruthy());
    expect(mocks.liveScore).toHaveBeenCalledWith("s1", expect.any(String), "q1");
  });

  it("retries a failed score fetch instead of spinning forever", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mocks.liveScore.mockResolvedValueOnce({ success: false, error: "boom" });
    render(<LiveParticipant survey={survey({ isQuiz: true })} />);
    fireEvent.change(screen.getByLabelText("player.yourName"), { target: { value: "Ada" } });
    fireEvent.click(screen.getByRole("button", { name: "live.join" }));
    act(() => mocks.presence?.({ index: 0, phase: "question" }));
    fireEvent.change(screen.getByLabelText("answer"), { target: { value: "hi" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "live.submitAnswer" }));
    });

    await act(async () => mocks.presence?.({ index: 0, phase: "reveal" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await waitFor(() => expect(screen.getByText("live.correct")).toBeTruthy());
    expect(mocks.liveScore).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("settles the score when the presenter moves on without a reveal", async () => {
    render(<LiveParticipant survey={survey({ isQuiz: true })} />);
    fireEvent.change(screen.getByLabelText("player.yourName"), { target: { value: "Ada" } });
    fireEvent.click(screen.getByRole("button", { name: "live.join" }));
    act(() => mocks.presence?.({ index: 0, phase: "question" }));
    fireEvent.change(screen.getByLabelText("answer"), { target: { value: "hi" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "live.submitAnswer" }));
    });
    expect(mocks.liveScore).not.toHaveBeenCalled();

    await act(async () => mocks.presence?.({ index: 1, phase: "question" }));
    await waitFor(() => expect(mocks.liveScore).toHaveBeenCalledWith("s1", expect.any(String), "q1"));
  });

  it("goes straight to the question when no name is needed", () => {
    render(<LiveParticipant survey={survey({})} />);
    act(() => mocks.presence?.({ index: 0, phase: "question" }));

    expect(screen.queryByLabelText("player.yourName")).toBeNull();
    expect(screen.getByText("Q1")).toBeTruthy();
  });
});
