import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Question } from "@/app/types/survey";

vi.mock("@/app/i18n/context", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

import { QuestionQuizEditor } from "../question-quiz-editor";

const checkboxes = {
  id: "q",
  type: "checkboxes",
  title: "Pick",
  required: false,
  order: 0,
  points: 2,
  options: [
    { id: "a", label: "Alpha" },
    { id: "b", label: "Beta" },
  ],
  correctAnswers: ["a"],
  settings: { other: true },
} as unknown as Question;

describe("QuestionQuizEditor partial credit", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  it("turns on partial credit for checkbox questions, keeping other settings", () => {
    const onChange = vi.fn();
    render(<QuestionQuizEditor question={checkboxes} onChange={onChange} />);

    fireEvent.click(screen.getByRole("switch", { name: "builder.quiz.partialCredit" }));

    expect(onChange).toHaveBeenCalledWith({ settings: { other: true, partialCredit: true } });
  });

  it("does not offer partial credit in live quizzes", () => {
    render(<QuestionQuizEditor question={checkboxes} onChange={vi.fn()} liveMode />);
    expect(screen.queryByRole("switch", { name: "builder.quiz.partialCredit" })).toBeNull();
  });

  it("does not offer partial credit for single choice", () => {
    render(<QuestionQuizEditor question={{ ...checkboxes, type: "multiple-choice" }} onChange={vi.fn()} />);
    expect(screen.queryByRole("switch", { name: "builder.quiz.partialCredit" })).toBeNull();
  });
});
