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

describe("QuestionQuizEditor points per answer", () => {
  it("hides partial credit once options have their own points and can go back", () => {
    const onChange = vi.fn();
    const scored = { ...checkboxes, settings: { other: true, optionPoints: { a: 1, b: -1 } } } as Question;
    render(<QuestionQuizEditor question={scored} onChange={onChange} />);
    expect(screen.queryByRole("switch", { name: "builder.quiz.partialCredit" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "builder.quiz.resetOptionPoints" }));
    expect(onChange).toHaveBeenCalledWith({ settings: { other: true } });
  });

  it("scores a ranking's order on request", () => {
    const onChange = vi.fn();
    const ranking = { ...checkboxes, type: "ranking", settings: {} } as unknown as Question;
    render(<QuestionQuizEditor question={ranking} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch", { name: "builder.quiz.scoreOrder" }));
    expect(onChange).toHaveBeenCalledWith({ settings: { scoreOrder: true } });
  });

  it("gives an accepted short answer its own points", () => {
    const onChange = vi.fn();
    const short = {
      ...checkboxes,
      type: "short-answer",
      options: undefined,
      correctAnswers: ["Berlin", "Berlin, Germany"],
      settings: {},
    } as unknown as Question;
    render(<QuestionQuizEditor question={short} onChange={onChange} />);
    fireEvent.change(screen.getAllByLabelText("builder.quiz.pointsFor")[1], { target: { value: "1" } });
    expect(onChange).toHaveBeenCalledWith({
      correctAnswers: ["Berlin", "Berlin, Germany"],
      settings: { answerPoints: { "Berlin, Germany": 1 } },
    });
  });
});

