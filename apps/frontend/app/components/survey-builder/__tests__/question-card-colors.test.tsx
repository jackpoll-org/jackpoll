import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Question, Survey } from "@/app/types/survey";

const updateQuestion = vi.fn();
const mock = { survey: {} as Survey };

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../builder-context", () => ({
  useBuilder: () => ({
    ...mock,
    updateQuestion,
    setQuestionSection: vi.fn(),
    removeQuestion: vi.fn(),
    moveQuestion: vi.fn(),
    focusByQuestion: new Map(),
    attemptedSave: false,
    setFocus: vi.fn(),
  }),
}));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({ t: (k: string) => (k === "builder.palette.sample" ? "Alpha,Beta,Gamma" : k) }),
}));
vi.mock("../collab-text-input", () => ({ CollabTextInput: () => null }));

import { QuestionCard } from "../question-card";

function setup(q: Question, surveyPalette?: string[]) {
  mock.survey = {
    id: "s1",
    ownerId: "o1",
    title: "T",
    status: "draft",
    settings: { colorPalette: surveyPalette } as Survey["settings"],
    questions: [q],
    sections: [],
    createdAt: "",
    updatedAt: "",
  };
  render(<QuestionCard question={q} index={0} total={1} />);
}

function cloud(settings: Record<string, unknown>): Question {
  return { id: "q1", type: "wordcloud", title: "Words", required: false, order: 0, settings };
}

function sampleColors(root: HTMLElement) {
  return [...root.querySelectorAll("span")].map((s) => s.style.color);
}

beforeEach(() => {
  updateQuestion.mockReset();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(cleanup);

describe("QuestionCard word cloud colors", () => {
  it("previews the theme colors and saves a chosen palette through updateQuestion", async () => {
    setup(cloud({ maxWords: 3 }));
    expect(sampleColors(screen.getByTestId("palette-sample"))[0]).toBe("var(--chart-1)");

    fireEvent.click(screen.getByRole("button", { name: "builder.palette.customize" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.input(within(dialog).getByLabelText("2"), { target: { value: "#123456" } });
    expect(sampleColors(within(dialog).getByTestId("palette-sample"))[1]).toBe("rgb(18, 52, 86)");
    fireEvent.click(within(dialog).getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(updateQuestion).toHaveBeenCalledTimes(1));
    const [id, patch] = updateQuestion.mock.calls[0];
    expect(id).toBe("q1");
    expect(patch.settings.maxWords).toBe(3);
    expect(patch.settings.colorPalette).toHaveLength(10);
    expect(patch.settings.colorPalette[1]).toBe("#123456");
  });

  it("shows the question palette and clears it back to the survey colors", async () => {
    setup(cloud({ maxWords: 3, colorPalette: ["#ff0000", "#00ff00"] }), ["#0000ff"]);
    expect(sampleColors(screen.getByTestId("palette-sample"))).toEqual([
      "rgb(255, 0, 0)",
      "rgb(0, 255, 0)",
      "rgb(255, 0, 0)",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "builder.palette.customize" }));
    fireEvent.click(screen.getByRole("button", { name: "results.colors.question.useSurvey" }));

    await waitFor(() => expect(updateQuestion).toHaveBeenCalledWith("q1", { settings: { maxWords: 3 } }));
  });

  it("falls back to the survey palette in the preview", () => {
    setup(cloud({}), ["#0000ff"]);
    expect(sampleColors(screen.getByTestId("palette-sample"))[0]).toBe("rgb(0, 0, 255)");
  });

  it("offers colors for a choice question shown as a word cloud only", () => {
    const choice: Question = {
      id: "q1",
      type: "checkboxes",
      title: "Pick",
      required: false,
      order: 0,
      options: [],
      settings: { resultChart: "wordcloud" },
    };
    setup(choice);
    expect(screen.getByRole("button", { name: "builder.palette.customize" })).toBeTruthy();
    cleanup();
    setup({ ...choice, settings: { resultChart: "bar" } });
    expect(screen.queryByRole("button", { name: "builder.palette.customize" })).toBeNull();
  });
});
