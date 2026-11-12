import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { StudentResult } from "@/app/types/survey";

vi.mock("@/app/i18n/context", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

import { StudentResultView } from "../student-result";

describe("StudentResultView", () => {
  it("shows the teacher's feedback under the answer it belongs to", () => {
    const result = {
      survey: {
        title: "Databases",
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
});
