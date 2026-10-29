import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import type { Survey } from "@/app/types/survey";

const mocks = vi.hoisted(() => ({
  submit: vi.fn(async () => ({ score: 0 })),
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

  it("goes straight to the question when no name is needed", () => {
    render(<LiveParticipant survey={survey({})} />);
    act(() => mocks.presence?.({ index: 0, phase: "question" }));

    expect(screen.queryByLabelText("player.yourName")).toBeNull();
    expect(screen.getByText("Q1")).toBeTruthy();
  });
});
