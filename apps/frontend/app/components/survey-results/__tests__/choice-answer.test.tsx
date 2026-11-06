import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Question } from "@/app/types/survey";

vi.mock("@/app/i18n/context", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

import { ChoiceAnswer, optionStatus } from "../choice-answer";

const question = {
  id: "q",
  type: "checkboxes",
  title: "Pick",
  required: false,
  order: 0,
  options: [
    { id: "a", label: "Alpha" },
    { id: "b", label: "Beta" },
    { id: "c", label: "Gamma" },
    { id: "d", label: "Delta" },
  ],
  correctAnswers: ["a", "b"],
} as unknown as Question;

describe("optionStatus", () => {
  it("maps selection and correctness to the four colours", () => {
    expect(optionStatus(true, true)).toBe("hit");
    expect(optionStatus(false, true)).toBe("missed");
    expect(optionStatus(true, false)).toBe("wrong");
    expect(optionStatus(false, false)).toBe("neutral");
    expect(optionStatus(true, null)).toBe("selected");
  });
});

describe("ChoiceAnswer", () => {
  it("lists every option with its status", () => {
    render(<ChoiceAnswer question={question} value={["a", "c"]} />);
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual([
      "Alphagrading.option.hit",
      "Betagrading.option.missed",
      "Gammagrading.option.wrong",
      "Deltagrading.option.neutral",
    ]);
  });

  it("shows a selected option that was removed later as wrong", () => {
    render(<ChoiceAnswer question={question} value={["a", "gone"]} />);
    expect(screen.getByText("grading.option.removed").parentElement?.textContent).toContain(
      "grading.option.wrong",
    );
  });

  it("only marks selections when there is no answer key", () => {
    render(<ChoiceAnswer question={{ ...question, correctAnswers: [] }} value={["c"]} />);
    expect(screen.getByText("Gamma").parentElement?.textContent).toContain("grading.option.selected");
    expect(screen.getByText("Alpha").parentElement?.textContent).toContain("grading.option.neutral");
  });
});
