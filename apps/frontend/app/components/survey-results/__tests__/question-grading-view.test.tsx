import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { Survey, SurveyResponseDto } from "@/app/types/survey";

const replace = vi.fn();
const gradeMutate = vi.fn();
const feedbackMutate = vi.fn();
let responses: SurveyResponseDto[] = [];
let gradePending = false;

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, string>) => (vars ? `${k} ${Object.values(vars).join(" ")}` : k),
  }),
}));

const survey = {
  id: "s1",
  title: "Databases",
  settings: { isQuiz: true },
  questions: [
    { id: "essay", type: "long-answer", title: "Explain keys", required: false, order: 0, points: 5 },
    { id: "intro", type: "content", title: "Read", required: false, order: 1 },
    { id: "sql", type: "short-answer", title: "Language?", required: false, order: 2, points: 2, correctAnswers: ["SQL"] },
  ],
} as unknown as Survey;

vi.mock("@/app/hooks/survey", () => ({
  useSurvey: () => ({ data: survey, isLoading: false }),
  useResponses: () => ({ data: responses, isLoading: false }),
  useGradeQuestion: () => ({ mutate: gradeMutate, isPending: gradePending }),
  useAnswerFeedback: () => ({ mutateAsync: feedbackMutate }),
}));

import { QuestionGradingView } from "../question-grading-view";

const response = (id: string, essay: string, name?: string, points: number | null = null) =>
  ({
    id,
    submittedAt: `2026-11-06T10:0${id}:00Z`,
    respondentName: name,
    answers: [{ questionId: "essay", value: essay, awardedPoints: points }],
  }) as unknown as SurveyResponseDto;

describe("QuestionGradingView", () => {
  beforeEach(() => {
    replace.mockReset();
    gradeMutate.mockReset();
    gradePending = false;
    feedbackMutate.mockReset();
    feedbackMutate.mockResolvedValue([]);
    responses = [
      response("1", "Identifies a row", "Ada"),
      response("2", "Identifies a row", undefined),
      response("3", "Links tables", "Bob", 4),
    ];
  });

  it("groups identical answers and grades the whole group at once", () => {
    render(<QuestionGradingView surveyId="s1" questionId="essay" sessionId={null} />);

    expect(screen.getByRole("heading", { name: "Explain keys" })).toBeTruthy();
    expect(screen.getByText("grading.byQuestion.count 2")).toBeTruthy();
    expect(screen.getByText("grading.byQuestion.ungraded 2")).toBeTruthy();

    const groupInput = screen.getByLabelText("grading.byQuestion.pointsForAll");
    fireEvent.change(groupInput, { target: { value: "3" } });
    fireEvent.blur(groupInput);

    expect(gradeMutate).toHaveBeenCalledWith(
      {
        questionId: "essay",
        grades: [
          { responseId: "1", points: 3 },
          { responseId: "2", points: 3 },
        ],
      },
      expect.anything(),
    );
  });

  it("gives the same feedback to every answer in a group", () => {
    render(<QuestionGradingView surveyId="s1" questionId="essay" sessionId={null} />);

    const field = screen.getByLabelText("grading.byQuestion.feedbackForAll");
    fireEvent.change(field, { target: { value: "Also say what a row is." } });
    fireEvent.blur(field);

    expect(feedbackMutate).toHaveBeenCalledWith({
      questionId: "essay",
      responseIds: ["1", "2"],
      feedback: "Also say what a row is.",
    });
  });

  it("saves points changed with the arrows without leaving the field", () => {
    vi.useFakeTimers();
    try {
      render(<QuestionGradingView surveyId="s1" questionId="essay" sessionId={null} />);
      fireEvent.change(screen.getByLabelText("grading.byQuestion.pointsForAll"), { target: { value: "2" } });
      expect(gradeMutate).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(1000));

      expect(gradeMutate).toHaveBeenCalledTimes(1);
      expect(gradeMutate.mock.calls[0][0]).toEqual({
        questionId: "essay",
        grades: [
          { responseId: "1", points: 2 },
          { responseId: "2", points: 2 },
        ],
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits for a running save, then saves the newer points", () => {
    vi.useFakeTimers();
    try {
      const view = render(<QuestionGradingView surveyId="s1" questionId="essay" sessionId={null} />);
      const field = () => screen.getByLabelText("grading.byQuestion.pointsForAll");
      fireEvent.change(field(), { target: { value: "2" } });
      act(() => vi.advanceTimersByTime(1000));
      expect(gradeMutate).toHaveBeenCalledTimes(1);

      gradePending = true;
      view.rerender(<QuestionGradingView surveyId="s1" questionId="essay" sessionId={null} />);
      fireEvent.change(field(), { target: { value: "3" } });
      act(() => vi.advanceTimersByTime(1000));
      expect(gradeMutate).toHaveBeenCalledTimes(1);

      gradePending = false;
      view.rerender(<QuestionGradingView surveyId="s1" questionId="essay" sessionId={null} />);
      act(() => vi.advanceTimersByTime(1000));
      expect(gradeMutate).toHaveBeenCalledTimes(2);
      expect(gradeMutate.mock.calls[1][0].grades[0].points).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps points being typed when fresh data arrives", () => {
    const view = render(<QuestionGradingView surveyId="s1" questionId="essay" sessionId={null} />);
    const field = () => screen.getByLabelText("grading.byQuestion.pointsForAll") as HTMLInputElement;
    fireEvent.change(field(), { target: { value: "4" } });

    responses = [
      response("1", "Identifies a row", "Ada", 2),
      response("2", "Identifies a row", undefined, 2),
      response("3", "Links tables", "Bob", 4),
    ];
    view.rerender(<QuestionGradingView surveyId="s1" questionId="essay" sessionId={null} />);

    expect(field().value).toBe("4");
  });

  it("follows the server again after the points are put back unchanged", () => {
    vi.useFakeTimers();
    try {
      const view = render(<QuestionGradingView surveyId="s1" questionId="essay" sessionId={null} />);
      const field = () => screen.getByLabelText("grading.byQuestion.pointsForAll") as HTMLInputElement;
      fireEvent.change(field(), { target: { value: "1" } });
      fireEvent.change(field(), { target: { value: "" } });
      act(() => vi.advanceTimersByTime(1000));
      expect(gradeMutate).not.toHaveBeenCalled();

      responses = [
        response("1", "Identifies a row", "Ada", 5),
        response("2", "Identifies a row", undefined, 5),
        response("3", "Links tables", "Bob", 4),
      ];
      view.rerender(<QuestionGradingView surveyId="s1" questionId="essay" sessionId={null} />);
      expect(field().value).toBe("5");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not resave a group whose points were not touched", () => {
    render(<QuestionGradingView surveyId="s1" questionId="essay" sessionId={null} />);
    fireEvent.blur(screen.getByLabelText("grading.byQuestion.pointsForAll"));
    expect(gradeMutate).not.toHaveBeenCalled();
  });

  it("moves between gradable questions and skips content blocks", () => {
    render(<QuestionGradingView surveyId="s1" questionId="essay" sessionId="round-1" />);
    expect(screen.getByText(/grading.byQuestion.position 1 2/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /grading.byQuestion.next/ }));
    expect(replace).toHaveBeenCalledWith("/surveys/s1/results/grade-question/sql?session=round-1");
  });

  it("explains when the question can't be graded", () => {
    render(<QuestionGradingView surveyId="s1" questionId="intro" sessionId={null} />);
    expect(screen.getByText("grading.byQuestion.notFound")).toBeTruthy();
  });
});
