import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Survey, SurveyResponseDto } from "@/app/types/survey";

let responses: SurveyResponseDto[] = [];

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock("@/app/hooks/survey", () => ({
  useResponses: () => ({ data: responses, isLoading: false }),
  useDeleteResponse: () => ({ mutate: vi.fn(), isPending: false }),
  useClearResponses: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { ResponsesPanel } from "../responses-panel";

const survey = (settings: Partial<Survey["settings"]>) =>
  ({
    id: "s1",
    title: "Quiz",
    settings: { isQuiz: true, ...settings },
    questions: [],
  }) as unknown as Survey;

describe("ResponsesPanel", () => {
  beforeEach(() => {
    responses = [
      { id: "r1", submittedAt: "2026-11-17T13:07:01Z", score: 14, maxScore: 27, grade: "4", answers: [] },
      { id: "r2", submittedAt: "2026-11-17T13:05:56Z", score: null, maxScore: 27, grade: null, answers: [] },
    ] as SurveyResponseDto[];
  });

  it("shows each response's grade when the quiz has a grading scale", () => {
    render(<ResponsesPanel survey={survey({ gradingScale: [{ label: "4", minScore: 0 }] })} />);

    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    const gradeColumn = headers.indexOf("results.responses.colGrade");
    expect(gradeColumn).toBe(headers.indexOf("results.responses.colScore") + 1);
    const [first, second] = screen.getAllByRole("row").slice(1).map((row) => row.querySelectorAll("td"));
    expect(first[gradeColumn - 1].textContent).toBe("14/27");
    expect(first[gradeColumn].textContent).toBe("4");
    expect(second[gradeColumn].textContent).toBe("—");
  });

  it("hides the grade column without a grading scale", () => {
    render(<ResponsesPanel survey={survey({})} />);

    expect(screen.queryByRole("columnheader", { name: "results.responses.colGrade" })).toBeNull();
  });
});
