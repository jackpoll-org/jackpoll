import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import type { Survey } from "@/app/types/survey";

const mocks = vi.hoisted(() => ({
  submit: vi.fn(async (): Promise<{ score: number }> => ({ score: 0 })),
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

async function answer() {
  fireEvent.change(screen.getByLabelText("answer"), { target: { value: "hi" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "live.submitAnswer" }));
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("LiveParticipant respondent token", () => {
  it("asks a late joiner for the token before the current question and sends it with each answer", async () => {
    render(<LiveParticipant survey={survey({ requireRespondentToken: true })} />);
    act(() => mocks.presence?.({ index: 0, phase: "question" }));

    expect(screen.queryByText("Q1")).toBeNull();
    expect(screen.queryByLabelText("player.yourName")).toBeNull();
    const join = screen.getByRole("button", { name: "live.join" });
    expect(join).toBeDisabled();
    fireEvent.change(screen.getByLabelText("player.token"), { target: { value: " T-1 " } });
    fireEvent.click(join);

    await answer();
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ respondentToken: "T-1" }));
    expect(mocks.join).not.toHaveBeenCalled();
  });

  it("prefills the token from the join link", () => {
    window.history.replaceState(null, "", "/s/abc?token=FromLink");
    render(<LiveParticipant survey={survey({ requireRespondentToken: true })} />);

    expect(screen.getByLabelText("player.token")).toHaveValue("FromLink");
    expect(screen.getByRole("button", { name: "live.join" })).toBeEnabled();
  });

  it("returns to the token screen when the token is rejected", async () => {
    mocks.submit.mockRejectedValueOnce(new Error("This token is not valid."));
    render(<LiveParticipant survey={survey({ requireRespondentToken: true })} />);
    act(() => mocks.presence?.({ index: 0, phase: "question" }));
    fireEvent.change(screen.getByLabelText("player.token"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "live.join" }));

    await answer();
    expect(screen.getByLabelText("player.token")).toBeInTheDocument();
  });
});
