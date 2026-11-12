import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Question } from "@/app/types/survey";

vi.mock("@/app/i18n/context", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

import { DeleteQuestionButton } from "../delete-question-button";

const question = (patch: Partial<Question>) =>
  ({ id: "q", type: "checkboxes", title: "", required: false, order: 0, options: [], ...patch }) as Question;

describe("DeleteQuestionButton", () => {
  it("asks before deleting a question with content and names it", () => {
    const onDelete = vi.fn();
    render(<DeleteQuestionButton question={question({ title: "Pick all true statements" })} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: "builder.question.delete" }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("Pick all true statements")).toBeTruthy();
    expect(screen.getByText("builder.question.deleteConfirmBody")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "builder.question.delete" }));
    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("asks when only the answer options are filled in", () => {
    const onDelete = vi.fn();
    render(
      <DeleteQuestionButton
        question={question({ options: [{ id: "a", label: "Alpha" }] } as Partial<Question>)}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "builder.question.delete" }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("builder.question.deleteConfirmTitle")).toBeTruthy();
  });

  it.each([
    ["a grid that still has its default rows and columns", { type: "multiple-choice-grid", rows: [{ id: "r", label: "Row 1" }], columns: [{ id: "c", label: "Column 1" }] }, false],
    ["a slider that still has its default range", { type: "slider", settings: { min: 0, max: 10, step: 1 } }, false],
    ["a saved slider whose settings came back reordered", { type: "slider", settings: { max: 10, min: 0, step: 1, minLabel: "", validation: [] } }, false],
    ["a slider with end labels", { type: "slider", settings: { min: 0, max: 10, step: 1, minLabel: "Bad" } }, true],
    ["a text block with only an image", { type: "content", settings: { image: { key: "k" } } }, true],
    ["a grid with its own rows", { type: "multiple-choice-grid", rows: [{ id: "r", label: "Monday" }], columns: [{ id: "c", label: "Column 1" }] }, true],
  ])("for %s asks first: %s", (_name, patch, asks) => {
    const onDelete = vi.fn();
    render(<DeleteQuestionButton question={question(patch as Partial<Question>)} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "builder.question.delete" }));
    expect(onDelete).toHaveBeenCalledTimes(asks ? 0 : 1);
  });

  it("deletes an empty question right away", () => {
    const onDelete = vi.fn();
    render(
      <DeleteQuestionButton
        question={question({ title: "  ", options: [{ id: "a", label: " " }] } as Partial<Question>)}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "builder.question.delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("builder.question.deleteConfirmTitle")).toBeNull();
  });
});
