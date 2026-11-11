import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Question } from "@/app/types/survey";

vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({
    t: (k: string, p?: Record<string, string>) => (p?.label ? `${k}:${p.label}` : k),
  }),
}));

import { ChoiceEditor } from "../editors/choice-editor";
import { addOptionLines } from "../helpers";

const question = {
  id: "q",
  type: "multiple-choice",
  title: "Capital?",
  required: false,
  order: 0,
  points: 2,
  options: [
    { id: "a", label: "Paris" },
    { id: "b", label: "Lyon" },
  ],
  correctAnswers: ["a"],
} as unknown as Question;

describe("ChoiceEditor in a quiz", () => {
  it("marks the correct answer right in the option row", () => {
    const onChange = vi.fn();
    render(<ChoiceEditor question={question} onChange={onChange} isQuiz />);
    fireEvent.click(screen.getByRole("radio", { name: "builder.quiz.markCorrect:Lyon" }));
    expect(onChange).toHaveBeenCalledWith({ correctAnswers: ["b"] });
  });

  it("starts option points from the answer key when one is edited", () => {
    const onChange = vi.fn();
    render(<ChoiceEditor question={question} onChange={onChange} isQuiz />);
    expect(screen.getByLabelText("builder.quiz.pointsFor:Paris")).toHaveAttribute("placeholder", "2");
    fireEvent.change(screen.getByLabelText("builder.quiz.pointsFor:Lyon"), { target: { value: "1" } });
    expect(onChange).toHaveBeenCalledWith({
      settings: { optionPoints: { a: 2, b: 1 } },
      correctAnswers: ["a"],
    });
  });

  it("lets the points decide what counts as correct once they are set", () => {
    const scored = { ...question, settings: { optionPoints: { a: 2, b: 1 } } } as Question;
    render(<ChoiceEditor question={scored} onChange={vi.fn()} isQuiz />);
    expect(screen.getByRole("radio", { name: "builder.quiz.markCorrect:Lyon" })).toBeDisabled();
    expect(screen.getByLabelText("builder.quiz.pointsFor:Lyon")).toHaveValue(1);
  });

  it("drops a removed option's points", () => {
    const onChange = vi.fn();
    const scored = { ...question, settings: { optionPoints: { a: 2, b: 1 } } } as Question;
    render(<ChoiceEditor question={scored} onChange={onChange} isQuiz />);
    fireEvent.click(screen.getByRole("button", { name: "qedit.removeItem:Lyon" }));
    expect(onChange).toHaveBeenCalledWith({
      options: [{ id: "a", label: "Paris" }],
      settings: { optionPoints: { a: 2 } },
      correctAnswers: ["a"],
    });
  });

  it("falls back to normal scoring when the last option with points is removed", () => {
    const onChange = vi.fn();
    const scored = { ...question, settings: { optionPoints: { b: 1 } } } as Question;
    render(<ChoiceEditor question={scored} onChange={onChange} isQuiz />);
    fireEvent.click(screen.getByRole("button", { name: "qedit.removeItem:Lyon" }));
    expect(onChange).toHaveBeenCalledWith({
      options: [{ id: "a", label: "Paris" }],
      settings: {},
      correctAnswers: ["a"],
    });
  });

  it("keeps points within the limit while typing", () => {
    const onChange = vi.fn();
    const scored = { ...question, settings: { optionPoints: { a: 2, b: 1 } } } as Question;
    render(<ChoiceEditor question={scored} onChange={onChange} isQuiz />);
    const input = screen.getByLabelText("builder.quiz.pointsFor:Lyon");
    fireEvent.change(input, { target: { value: "5000" } });
    expect(input).toHaveValue(1000);
    expect(onChange).toHaveBeenCalledWith({ settings: { optionPoints: { a: 2, b: 1000 } }, correctAnswers: ["b"] });
  });

  it("lets a points field be cleared and retyped", () => {
    const onChange = vi.fn();
    const scored = { ...question, settings: { optionPoints: { a: 2, b: 1 } } } as Question;
    render(<ChoiceEditor question={scored} onChange={onChange} isQuiz />);
    const input = screen.getByLabelText("builder.quiz.pointsFor:Lyon");
    fireEvent.change(input, { target: { value: "" } });
    expect(input).toHaveValue(null);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "-3" } });
    expect(onChange).toHaveBeenCalledWith({ settings: { optionPoints: { a: 2, b: -3 } }, correctAnswers: ["a"] });
  });

  it("shows no quiz controls outside a quiz", () => {
    render(<ChoiceEditor question={question} onChange={vi.fn()} />);
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByLabelText("builder.quiz.pointsFor:Paris")).toBeNull();
  });

  it("adds new options empty", () => {
    const onChange = vi.fn();
    render(<ChoiceEditor question={question} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "qedit.addOption" }));
    expect(onChange.mock.calls[0][0].options[2].label).toBe("");
  });
});

describe("addOptionLines", () => {
  it("adds one option per non-empty line and replaces blank options", () => {
    const next = addOptionLines([{ id: "x", label: "" }, { id: "y", label: "Keep" }], "  A \n\nB\n");
    expect(next.map((o) => o.label)).toEqual(["Keep", "A", "B"]);
    expect(addOptionLines([{ id: "x", label: "" }], "\n \n")).toEqual([{ id: "x", label: "" }]);
  });
});
