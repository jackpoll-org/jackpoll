import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import type { ReactNode } from "react";
import type { CloudWord } from "@/app/lib/results/wordcloud";
import { RESULTS_POLL_INTERVAL_MS } from "@/app/lib/survey/constants";
import type { Survey, SurveyResults } from "@/app/types/survey";

const mocks = vi.hoisted(() => ({
  submit: vi.fn(async () => ({ id: "r1", submittedAt: "x", answers: [] })),
  liveResults: vi.fn(),
  socket: vi.fn(),
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
  useLiveResults: mocks.liveResults,
}));
vi.mock("@/app/hooks/results-live", () => ({ useLiveResultsSocket: mocks.socket }));
vi.mock("@/app/components/survey-results/wordcloud-result", () => ({
  WordcloudResult: ({ words, live, legend }: { words: CloudWord[]; live?: boolean; legend?: ReactNode }) => (
    <div>
      {live && <span>wordcloud.live</span>}
      <ul data-testid="cloud-words">
        {words.map((w) => (
          <li key={w.key} style={{ color: w.color }}>
            {w.text}
          </li>
        ))}
      </ul>
      {legend}
    </div>
  ),
}));

import { SurveyPlayer } from "../survey-player";

const survey = {
  id: "s1",
  title: "Workshop",
  status: "published",
  settings: {
    showLiveResults: true,
    postSubmitSummary: true,
    postSubmitCombinedWordcloud: true,
    confirmationMessage: "Thanks!",
  },
  questions: [
    { id: "q1", type: "wordcloud", title: "Hopes", required: false, order: 0 },
    { id: "q2", type: "wordcloud", title: "Fears", required: false, order: 1 },
  ],
} as unknown as Survey;

const live: SurveyResults = {
  surveyId: "s1",
  title: "Workshop",
  totalResponses: 0,
  questions: [
    { questionId: "q1", type: "wordcloud", title: "Hopes", answered: 0, optionCounts: { fun: 2 } },
    { questionId: "q2", type: "wordcloud", title: "Fears", answered: 0, optionCounts: { fun: 1, rain: 1 } },
  ],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.socket.mockReset();
  window.localStorage.clear();
});

describe("SurveyPlayer combined word cloud", () => {
  it("shows only the live combined cloud after submitting, keeping the confirmation", async () => {
    mocks.liveResults.mockReturnValue({ isLoading: false, isError: false, data: live });
    render(<SurveyPlayer survey={survey} analytics />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "common.submit" }));
    });

    expect(screen.getByText("Thanks!")).toBeTruthy();
    expect(screen.getByTestId("combined-wordcloud")).toBeTruthy();
    expect(screen.getAllByText("fun")).toHaveLength(2);
    expect(screen.getByText("rain")).toBeTruthy();
    expect(screen.getByText("Hopes")).toBeTruthy();
    expect(screen.getByText("Fears")).toBeTruthy();
    expect(screen.queryByText("live.title")).toBeNull();
    expect(mocks.socket).toHaveBeenCalledWith("s1", true);
  });

  async function submit(target: Survey) {
    render(<SurveyPlayer survey={target} analytics />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "common.submit" }));
    });
  }

  it("polls and hides the live badge while push updates are unavailable", async () => {
    mocks.socket.mockReturnValue(false);
    mocks.liveResults.mockReturnValue({ isLoading: false, isError: false, data: live });
    await submit(survey);

    expect(mocks.liveResults).toHaveBeenLastCalledWith("s1", true, RESULTS_POLL_INTERVAL_MS, undefined);
    expect(screen.getByTestId("combined-wordcloud")).toBeTruthy();
    expect(screen.queryByText("wordcloud.live")).toBeNull();
  });

  it("stops polling, catches up once and shows the live badge once push updates arrive", async () => {
    const refetch = vi.fn();
    mocks.socket.mockReturnValue(true);
    mocks.liveResults.mockReturnValue({ isLoading: false, isError: false, data: live, refetch });
    await submit(survey);

    expect(mocks.liveResults).toHaveBeenLastCalledWith("s1", true, false, undefined);
    expect(screen.getByText("wordcloud.live")).toBeTruthy();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("renders nothing without a word-cloud question shown in live results", async () => {
    mocks.liveResults.mockReturnValue({ isLoading: false, isError: false, data: undefined });
    await submit({
      ...survey,
      questions: [
        { ...survey.questions[0], showInLiveResults: false },
        { id: "mc", type: "multiple-choice", title: "Pick", required: false, order: 1, options: [] },
      ],
    } as Survey);

    expect(screen.getByText("Thanks!")).toBeTruthy();
    expect(screen.queryByTestId("combined-wordcloud")).toBeNull();
    expect(mocks.liveResults).toHaveBeenLastCalledWith("s1", false, expect.anything(), undefined);
    expect(mocks.socket).toHaveBeenLastCalledWith("s1", false);
  });

  it("renders nothing when the live results hold no word cloud", async () => {
    mocks.liveResults.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { ...live, questions: [] },
    });
    await submit(survey);

    expect(screen.queryByTestId("combined-wordcloud")).toBeNull();
  });

  it("shows a short message instead of hiding when live results fail to load", async () => {
    mocks.liveResults.mockReturnValue({ isLoading: false, isError: true, data: undefined });
    await submit(survey);

    expect(screen.getByText("Thanks!")).toBeTruthy();
    expect(screen.getByText("wordcloud.combined.loadFailed")).toBeTruthy();
    expect(screen.queryByTestId("combined-wordcloud")).toBeNull();
  });

  it("keeps the last cloud when a later refetch fails", async () => {
    mocks.liveResults.mockReturnValue({ isLoading: false, isError: true, data: live });
    await submit(survey);

    expect(screen.getByTestId("combined-wordcloud")).toBeTruthy();
    expect(screen.queryByText("wordcloud.combined.loadFailed")).toBeNull();
  });

  it("previews the cloud from the tester's own words without fetching live results", async () => {
    mocks.liveResults.mockReturnValue({ isLoading: false, isError: true, data: undefined });
    render(<SurveyPlayer survey={{ ...survey, status: "draft" } as Survey} preview />);
    const [hopes] = screen.getAllByPlaceholderText("wordcloud.addWord");
    fireEvent.change(hopes, { target: { value: "sunshine" } });
    fireEvent.keyDown(hopes, { key: "Enter" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "common.submit" }));
    });

    expect(screen.getByText("Thanks!")).toBeTruthy();
    expect(screen.getByTestId("cloud-words").textContent).toBe("sunshine");
    expect(screen.getByText("wordcloud.combined.previewNote")).toBeTruthy();
    expect(screen.queryByText("wordcloud.combined.loadFailed")).toBeNull();
    expect(mocks.liveResults).not.toHaveBeenCalled();
    expect(mocks.socket).not.toHaveBeenCalled();
  });

  it("shows only the preview note when the tester entered no words", async () => {
    render(<SurveyPlayer survey={{ ...survey, status: "draft" } as Survey} preview />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "common.submit" }));
    });

    expect(screen.getByText("wordcloud.combined.previewNote")).toBeTruthy();
    expect(screen.queryByTestId("cloud-words")).toBeNull();
    expect(mocks.liveResults).not.toHaveBeenCalled();
  });

  const fruit = {
    id: "ch",
    type: "multiple-choice",
    title: "Fruit",
    required: false,
    order: 2,
    settings: { resultChart: "wordcloud" },
    options: [
      { id: "o1", label: "Apple" },
      { id: "o2", label: "Pear" },
    ],
  };

  it("includes choice questions shown as a word cloud, as option labels", async () => {
    mocks.liveResults.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        ...live,
        questions: [{ questionId: "ch", type: "multiple-choice", title: "Fruit", answered: 0, optionCounts: { o1: 0, o2: 4 } }],
      },
    });
    await submit({ ...survey, questions: [fruit] } as unknown as Survey);

    expect(mocks.socket).toHaveBeenCalledWith("s1", true);
    expect(screen.getByTestId("cloud-words").textContent).toBe("Pear");
    expect(screen.getByText("Fruit")).toBeTruthy();
  });

  it("previews a picked option of a choice question shown as a word cloud by its label", async () => {
    render(
      <SurveyPlayer survey={{ ...survey, status: "draft", questions: [fruit] } as unknown as Survey} preview />,
    );
    fireEvent.click(screen.getByLabelText("Apple"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "common.submit" }));
    });

    expect(screen.getByTestId("cloud-words").textContent).toBe("Apple");
  });

  it("leaves a scored quiz choice question out of the preview", async () => {
    const quiz = { ...survey, status: "draft", settings: { ...survey.settings, isQuiz: true } };
    render(
      <SurveyPlayer
        survey={{ ...quiz, questions: [{ ...fruit, correctAnswers: ["o1"] }] } as unknown as Survey}
        preview
      />,
    );
    fireEvent.click(screen.getByLabelText("Apple"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "common.submit" }));
    });

    expect(screen.queryByTestId("cloud-words")).toBeNull();
  });

  it("keeps the regular summary when the setting is off", async () => {
    mocks.liveResults.mockReturnValue({ isLoading: false, isError: false, data: live });
    render(
      <SurveyPlayer
        survey={{ ...survey, settings: { ...survey.settings, postSubmitCombinedWordcloud: false } }}
        analytics
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "common.submit" }));
    });

    expect(screen.queryByTestId("combined-wordcloud")).toBeNull();
    expect(screen.getByText("live.title")).toBeTruthy();
  });
});
