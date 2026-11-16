import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { StudentResult } from "@/app/types/survey";

vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, string>) =>
      vars ? `${k} ${Object.values(vars).join(" ")}` : k,
  }),
}));

import { StudentResultView } from "../student-result";

describe("StudentResultView", () => {
  it("shows the teacher's feedback under the answer it belongs to", () => {
    const result = {
      survey: {
        title: "Databases",
        settings: {},
        questions: [
          { id: "essay", type: "long-answer", title: "Explain keys", required: false, order: 0, points: 5 },
          { id: "erm", type: "file-upload", title: "Upload ERM", required: false, order: 1 },
        ],
      },
      response: {
        score: 4,
        maxScore: 5,
        answers: [
          { questionId: "essay", value: "A key", awardedPoints: 4, feedback: "Name the foreign key." },
          { questionId: "erm", value: [], feedback: null },
        ],
      },
    } as unknown as StudentResult;

    render(<StudentResultView result={result} />);

    expect(screen.getByText("Name the foreign key.")).toBeTruthy();
    expect(screen.getAllByText("studentResult.answerFeedback")).toHaveLength(1);
  });

  it("shows questions in test order with page headings and content blocks", () => {
    const result = {
      survey: {
        id: "s1",
        title: "Quiz",
        settings: { isQuiz: true },
        sections: [{ id: "p2", title: "Part two", order: 0 }],
        questions: [
          { id: "q1", type: "short-answer", title: "Created first", required: false, order: 0, sectionId: "p2", points: 2 },
          { id: "c1", type: "content", title: "Context text", required: false, order: 1 },
          { id: "q2", type: "long-answer", title: "Added later", required: false, order: 2, points: 3 },
        ],
      },
      response: {
        id: "r1",
        submittedAt: "2026-09-24T10:00:00Z",
        score: 2,
        maxScore: 5,
        answers: [
          { questionId: "q1", value: "SQL", autoPoints: 2 },
          { questionId: "q2", value: "Because" },
        ],
      },
    } as unknown as StudentResult;

    const { container } = render(<StudentResultView result={result} />);
    const text = container.textContent ?? "";
    const positions = ["Context text", "Added later", "Part two", "Created first"].map((s) =>
      text.indexOf(s),
    );
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual(positions.toSorted((a, b) => a - b));
    expect(screen.getByRole("heading", { name: "Part two" })).toBeTruthy();
    expect(screen.getByText("2 / 2")).toBeTruthy();
    expect(screen.getByText("– / 3")).toBeTruthy();
    expect(container.querySelector("#survey-q-c1")?.textContent).toBe("Context text");
  });
});
