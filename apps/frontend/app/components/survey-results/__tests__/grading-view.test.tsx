import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Survey, SurveyResponseDto } from "@/app/types/survey";

const replace = vi.fn();
const mutate = vi.fn();
let responses: SurveyResponseDto[] = [];

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, string>) =>
      vars ? `${k} ${Object.values(vars).join(" ")}` : k,
  }),
}));

const survey = {
  id: "s1",
  title: "Databases",
  settings: { isQuiz: true },
  questions: [
    { id: "intro", type: "content", title: "Read", required: false, order: 0 },
    { id: "essay", type: "long-answer", title: "Explain keys", required: false, order: 1, points: 5 },
    { id: "erm", type: "file-upload", title: "Upload ERM", required: false, order: 2 },
  ],
} as unknown as Survey;

vi.mock("@/app/hooks/survey", () => ({
  useSurvey: () => ({ data: survey, isLoading: false }),
  useResponses: () => ({ data: responses, isLoading: false }),
  useGradeResponse: () => ({ mutate }),
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
    expect(screen.queryByText("Read")).toBeNull(); // content block isn't graded
    expect(screen.getByRole("img", { name: "erm.png" })).toBeTruthy();
    const download = screen.getByRole("link", { name: /grading.download/ });
    expect(download.getAttribute("href")).toContain("download=1&name=erm.png");
  });

  it("saves valid points on blur", () => {
    render(<GradingView surveyId="s1" responseId="b" sessionId={null} />);
    const input = screen.getByLabelText("grading.points");

    fireEvent.change(input, { target: { value: "4" } });
    fireEvent.blur(input);

    expect(mutate).toHaveBeenCalledWith(
      { responseId: "b", grades: [{ questionId: "essay", points: 4 }] },
      expect.anything(),
    );
  });

  it("does not save points above the maximum", () => {
    render(<GradingView surveyId="s1" responseId="b" sessionId={null} />);
    const input = screen.getByLabelText("grading.points");

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
