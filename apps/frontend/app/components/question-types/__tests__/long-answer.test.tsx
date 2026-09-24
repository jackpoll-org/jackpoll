import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Question } from "@/app/types/survey";

vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

import { LongAnswerPreview, MAX_LONG_ANSWER_LENGTH } from "../previews/long-answer-preview";
import { rulesForType } from "@/app/lib/survey/validation";

const question = { id: "q1", type: "long-answer", title: "Explain" } as Question;

describe("LongAnswerPreview", () => {
  it("renders a multi-line text area that keeps line breaks", () => {
    const onChange = vi.fn();
    render(<LongAnswerPreview question={question} value="" onChange={onChange} />);
    const box = screen.getByRole("textbox");

    expect(box.tagName).toBe("TEXTAREA");
    expect(box.getAttribute("maxlength")).toBe(String(MAX_LONG_ANSWER_LENGTH));
    fireEvent.change(box, { target: { value: "First.\n\nSecond." } });
    expect(onChange).toHaveBeenCalledWith("First.\n\nSecond.");
  });

  it("is read-only without onChange (builder preview)", () => {
    render(<LongAnswerPreview question={question} value="Draft" />);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(true);
  });

  it("offers length rules but no pattern", () => {
    expect(rulesForType("long-answer")).toEqual(["minLength", "maxLength"]);
  });
});
