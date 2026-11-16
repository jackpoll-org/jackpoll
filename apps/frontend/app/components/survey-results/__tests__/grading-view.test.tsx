import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { Survey, SurveyResponseDto } from "@/app/types/survey";

const replace = vi.fn();
const mutate = vi.fn();
const reviewMutate = vi.fn();
const feedbackMutate = vi.fn();
let responses: SurveyResponseDto[] = [];
let reviewPending = false;

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, string>) =>
      vars ? `${k} ${Object.values(vars).join(" ")}` : k,
  }),
}));

let survey = {
  id: "s1",
  title: "Databases",
  settings: { isQuiz: true },
  questions: [
    { id: "intro", type: "content", title: "Read", required: false, order: 0 },
    { id: "essay", type: "long-answer", title: "Explain keys", required: false, order: 1, points: 5 },
    { id: "erm", type: "file-upload", title: "Upload ERM", required: false, order: 2 },
    {
      id: "sql",
      type: "short-answer",
      title: "Name the language",
      required: false,
      order: 3,
      points: 2,
      correctAnswers: ["SQL"],
    },
  ],
} as unknown as Survey;

vi.mock("@/app/hooks/survey", () => ({
  useSurvey: () => ({ data: survey, isLoading: false }),
  useResponses: () => ({ data: responses, isLoading: false }),
  useGradeResponse: () => ({ mutate }),
  useReviewResponse: () => ({ mutate: reviewMutate, isPending: reviewPending }),
  useAnswerFeedback: () => ({ mutateAsync: feedbackMutate }),
}));

import { GradingView, parsePoints } from "../grading-view";

const response = (id: string, submittedAt: string, patch: Partial<SurveyResponseDto> = {}) =>
  ({
    id,
    submittedAt,
    score: 0,
    maxScore: 5,
    gradingPending: true,
    respondentName: `Student ${id}`,
    answers: [
      { questionId: "essay", value: "A primary key\nidentifies a row." },
      {
        questionId: "erm",
        value: [{ key: "uploads/k1.png", url: "", filename: "erm.png", contentType: "image/png", size: 1 }],
      },
    ],
    ...patch,
  }) as SurveyResponseDto;

describe("GradingView", () => {
  beforeEach(() => {
    replace.mockReset();
    mutate.mockReset();
    reviewMutate.mockReset();
    feedbackMutate.mockReset();
    feedbackMutate.mockResolvedValue([]);
    responses = [
      response("b", "2026-09-24T10:05:00Z"),
      response("a", "2026-09-24T10:00:00Z", { gradingPending: false, score: 4 }),
    ];
  });

  it("shows one submission with its answers, files and position", () => {
    render(<GradingView surveyId="s1" responseId="b" sessionId={null} />);

    expect(screen.getByRole("heading", { name: "Student b" })).toBeTruthy();
    expect(screen.getByText(/grading.position 2 2/)).toBeTruthy();
    expect(screen.getByText(/identifies a row/)).toBeTruthy();
    expect(screen.getByRole("img", { name: "erm.png" })).toBeTruthy();
    const download = screen.getByRole("link", { name: /grading.download/ });
    expect(download.getAttribute("href")).toContain("download=1&name=erm.png");
  });

  it("saves valid points on blur", () => {
    render(<GradingView surveyId="s1" responseId="b" sessionId={null} />);
    const input = screen.getAllByLabelText("grading.points")[0];

    fireEvent.change(input, { target: { value: "4" } });
    fireEvent.blur(input);

    expect(mutate).toHaveBeenCalledWith(
      { responseId: "b", grades: [{ questionId: "essay", points: 4 }] },
      expect.anything(),
    );
  });

  it("saves points changed with the arrows without leaving the field", () => {
    vi.useFakeTimers();
    try {
      render(<GradingView surveyId="s1" responseId="b" sessionId={null} />);
      const field = screen.getAllByLabelText("grading.points")[0];
      fireEvent.change(field, { target: { value: "3" } });
      expect(mutate).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(1000));

      expect(mutate).toHaveBeenCalledTimes(1);
      fireEvent.blur(field);
      expect(mutate).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries a failed save on blur, not on its own", () => {
    vi.useFakeTimers();
    try {
      render(<GradingView surveyId="s1" responseId="b" sessionId={null} />);
      const field = screen.getAllByLabelText("grading.points")[0];
      fireEvent.change(field, { target: { value: "3" } });
      act(() => vi.advanceTimersByTime(1000));
      expect(mutate).toHaveBeenCalledTimes(1);

      act(() => mutate.mock.calls[0][1].onError(new Error("offline")));
      act(() => vi.advanceTimersByTime(5000));
      expect(mutate).toHaveBeenCalledTimes(1);

      fireEvent.blur(field);
      expect(mutate).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not save points above the maximum", () => {
    render(<GradingView surveyId="s1" responseId="b" sessionId={null} />);
    const input = screen.getAllByLabelText("grading.points")[0];

    fireEvent.change(input, { target: { value: "9" } });
    fireEvent.blur(input);

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByText(/grading.invalidPoints 5/)).toBeTruthy();
  });

  it("moves between submissions in submission order, keeping the session", () => {
    render(<GradingView surveyId="s1" responseId="b" sessionId="round-2" />);

    fireEvent.click(screen.getByRole("button", { name: /grading.previous/ }));
    expect(replace).toHaveBeenCalledWith("/surveys/s1/results/grade/a?session=round-2");

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(replace).toHaveBeenCalledTimes(2);
  });
});

describe("GradingView overrides and review", () => {
  beforeEach(() => {
    mutate.mockReset();
    reviewMutate.mockReset();
    feedbackMutate.mockReset();
    feedbackMutate.mockResolvedValue([]);
    responses = [
      response("b", "2026-09-24T10:05:00Z", {
        answers: [{ questionId: "sql", value: "Structured Query Language", autoPoints: 0 }],
      }),
    ];
  });

  it("lets the teacher override an automatically scored answer", () => {
    render(<GradingView surveyId="s1" responseId="b" sessionId={null} />);
    expect(screen.getByText(/grading.autoPointsHint 0/)).toBeTruthy();
    const input = screen.getByLabelText("grading.points");

    fireEvent.change(input, { target: { value: "2" } });
    fireEvent.blur(input);

    expect(mutate).toHaveBeenCalledWith(
      { responseId: "b", grades: [{ questionId: "sql", points: 2 }] },
      expect.anything(),
    );
  });

  it("saves feedback on one answer when the field loses focus", () => {
    render(<GradingView surveyId="s1" responseId="b" sessionId={null} />);

    const field = screen.getByLabelText("grading.answerFeedback");
    fireEvent.blur(field);
    expect(feedbackMutate).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: "  Spell out the acronym.  " } });
    fireEvent.blur(field);
    expect(feedbackMutate).toHaveBeenCalledWith({
      questionId: "sql",
      responseIds: ["b"],
      feedback: "Spell out the acronym.",
    });
  });

  it("saves feedback typed while an earlier save was still running", async () => {
    let finishFirst: (value: unknown) => void = () => {};
    feedbackMutate.mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)));
    const view = render(<GradingView surveyId="s1" responseId="b" sessionId={null} />);
    const field = screen.getByLabelText("grading.answerFeedback");

    fireEvent.change(field, { target: { value: "Spell" } });
    fireEvent.blur(field);
    fireEvent.change(field, { target: { value: "Spell it out." } });
    fireEvent.blur(field);
    expect(feedbackMutate).toHaveBeenCalledTimes(1);

    view.unmount();
    await act(async () => finishFirst([]));
    expect(feedbackMutate).toHaveBeenCalledTimes(2);
    expect(feedbackMutate.mock.calls[1][0]).toEqual({
      questionId: "sql",
      responseIds: ["b"],
      feedback: "Spell it out.",
    });
  });

  it("saves bonus points and feedback", () => {
    render(<GradingView surveyId="s1" responseId="b" sessionId={null} />);

    fireEvent.change(screen.getByLabelText("grading.bonus"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("grading.feedback"), { target: { value: " Good work " } });
    fireEvent.click(screen.getByRole("button", { name: /grading.saveReview/ }));

    expect(reviewMutate).toHaveBeenCalledWith(
      { responseId: "b", review: { bonusPoints: 3, feedback: "Good work" } },
      expect.anything(),
    );
  });

  it("saves bonus points shortly after typing, so they count towards the total", () => {
    vi.useFakeTimers();
    try {
      render(<GradingView surveyId="s1" responseId="b" sessionId={null} />);
      const field = screen.getByLabelText("grading.bonus");
      fireEvent.change(field, { target: { value: "3" } });
      expect(reviewMutate).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(1000));

      expect(reviewMutate).toHaveBeenCalledTimes(1);
      expect(reviewMutate.mock.calls[0][0]).toEqual({
        responseId: "b",
        review: { bonusPoints: 3, feedback: null },
      });
      fireEvent.blur(field);
      expect(reviewMutate).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("saves bonus points when the field loses focus", () => {
    render(<GradingView surveyId="s1" responseId="b" sessionId={null} />);
    const field = screen.getByLabelText("grading.bonus");

    fireEvent.blur(field);
    expect(reviewMutate).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: "-2" } });
    fireEvent.blur(field);
    expect(reviewMutate.mock.calls[0][0]).toEqual({
      responseId: "b",
      review: { bonusPoints: -2, feedback: null },
    });
  });

  it("retries a failed bonus save on blur, not on its own", () => {
    vi.useFakeTimers();
    try {
      render(<GradingView surveyId="s1" responseId="b" sessionId={null} />);
      const field = screen.getByLabelText("grading.bonus");
      fireEvent.change(field, { target: { value: "3" } });
      act(() => vi.advanceTimersByTime(1000));
      expect(reviewMutate).toHaveBeenCalledTimes(1);

      act(() => reviewMutate.mock.calls[0][1].onError(new Error("offline")));
      act(() => vi.advanceTimersByTime(5000));
      expect(reviewMutate).toHaveBeenCalledTimes(1);

      fireEvent.blur(field);
      expect(reviewMutate).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps save and next usable while a bonus save is running", () => {
    reviewPending = true;
    try {
      responses = [...responses, response("c", "2026-09-24T10:10:00Z")];
      render(<GradingView surveyId="s1" responseId="b" sessionId={null} />);
      fireEvent.change(screen.getByLabelText("grading.bonus"), { target: { value: "3" } });
      fireEvent.click(screen.getByRole("button", { name: /grading.saveAndNext/ }));

      expect(reviewMutate).toHaveBeenCalledTimes(1);
      act(() => reviewMutate.mock.calls[0][1].onSuccess());
      expect(replace).toHaveBeenCalledWith("/surveys/s1/results/grade/c");
    } finally {
      reviewPending = false;
    }
  });

  it("saves a bonus changed while an earlier bonus save is still running", () => {
    reviewPending = true;
    try {
      render(<GradingView surveyId="s1" responseId="b" sessionId={null} />);
      const field = screen.getByLabelText("grading.bonus");
      fireEvent.change(field, { target: { value: "3" } });
      fireEvent.blur(field);
      fireEvent.change(field, { target: { value: "35" } });
      fireEvent.blur(field);

      expect(reviewMutate).toHaveBeenCalledTimes(2);
      expect(reviewMutate.mock.calls[1][0]).toEqual({
        responseId: "b",
        review: { bonusPoints: 35, feedback: null },
      });
    } finally {
      reviewPending = false;
    }
  });

  it("does not save invalid bonus points on its own", () => {
    vi.useFakeTimers();
    try {
      render(<GradingView surveyId="s1" responseId="b" sessionId={null} />);
      const field = screen.getByLabelText("grading.bonus");
      fireEvent.change(field, { target: { value: "1.5" } });
      act(() => vi.advanceTimersByTime(1000));
      fireEvent.blur(field);
      expect(reviewMutate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects bonus points that are not whole numbers", () => {
    render(<GradingView surveyId="s1" responseId="b" sessionId={null} />);

    fireEvent.change(screen.getByLabelText("grading.bonus"), { target: { value: "1.5" } });

    expect(
      (screen.getByRole("button", { name: /grading.saveReview/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe("parsePoints", () => {
  it("accepts whole numbers in range and blank to clear", () => {
    expect(parsePoints("3", 5)).toBe(3);
    expect(parsePoints("", 5)).toBeNull();
    expect(parsePoints("2.5", 5)).toBe("invalid");
    expect(parsePoints("-1", 5)).toBe("invalid");
  });
});

describe("GradingView file answers", () => {
  it("offers non-image files for download without an image preview", () => {
    responses = [
      response("b", "2026-09-24T10:05:00Z", {
        answers: [
          {
            questionId: "erm",
            value: [{ key: "uploads/k2.pdf", url: "", filename: "erm.pdf", contentType: "application/pdf", size: 1 }],
          },
        ],
      }),
    ];
    render(<GradingView surveyId="s1" responseId="b" sessionId={null} />);
    expect(screen.queryByRole("img", { name: "erm.pdf" })).toBeNull();
    expect(screen.getByRole("link", { name: /grading.download/ }).getAttribute("href")).toContain(
      "name=erm.pdf",
    );
  });
});

describe("GradingView page order", () => {
  const original = survey;
  beforeEach(() => {
    mutate.mockReset();
    feedbackMutate.mockReset();
    feedbackMutate.mockResolvedValue([]);
    survey = {
      ...original,
      sections: [{ id: "p2", title: "Part two", order: 0 }],
      questions: [
        { id: "sql", type: "short-answer", title: "Created first", required: false, order: 0, points: 2, sectionId: "p2" },
        { id: "intro", type: "content", title: "Context text", required: false, order: 1 },
        { id: "essay", type: "long-answer", title: "Added later", required: false, order: 2, points: 5 },
      ],
    } as unknown as Survey;
    responses = [response("b", "2026-09-24T10:05:00Z")];
  });

  afterEach(() => {
    survey = original;
  });

  it("lists questions in test order with page headings and ungraded content blocks", () => {
    const { container } = render(<GradingView surveyId="s1" responseId="b" sessionId={null} />);
    const text = container.textContent ?? "";
    const positions = ["Context text", "Added later", "Part two", "Created first"].map((s) =>
      text.indexOf(s),
    );
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual(positions.toSorted((a, b) => a - b));
    expect(screen.getByRole("heading", { name: "Part two" })).toBeTruthy();
    expect(screen.getAllByLabelText("grading.points")).toHaveLength(1);
  });
});
