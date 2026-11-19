import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import type { Survey, UpdateSurveyRequest } from "@/app/types/survey";

const mutateAsync = vi.fn<(req: UpdateSurveyRequest) => Promise<void>>();
const getSurveyApi = vi.fn();

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: "en" }),
}));
vi.mock("@/app/hooks/survey", () => ({
  useUpdateSurvey: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("@/app/lib/survey/api", () => ({
  getSurveyApi: (id: string) => getSurveyApi(id),
}));

import { ChartColorsDialog, QuestionColorsDialog } from "../chart-colors-dialog";

const stale = {
  id: "s1",
  title: "Old title",
  status: "draft",
  settings: { colorPalette: ["#aaaaaa"] },
  questions: [
    { id: "q1", type: "wordcloud", title: "Words", settings: { maxWords: 3 } },
    { id: "q2", type: "wordcloud", title: "Other", settings: {} },
  ],
} as unknown as Survey;

const latest = {
  ...stale,
  title: "Edited in builder",
  questions: [
    { id: "q1", type: "wordcloud", title: "Words renamed", settings: { maxWords: 5, colorPalette: ["#cccccc"] } },
    { id: "q2", type: "wordcloud", title: "Other", settings: {} },
    { id: "q3", type: "short-answer", title: "New", settings: null },
  ],
} as unknown as Survey;

beforeEach(() => {
  mutateAsync.mockReset().mockResolvedValue(undefined);
  getSurveyApi.mockReset().mockResolvedValue({ success: true, data: latest });
});
afterEach(cleanup);

describe("QuestionColorsDialog", () => {
  it("saves the question palette onto the latest survey without touching other edits", async () => {
    render(<QuestionColorsDialog survey={stale} questionId="q1" />);
    fireEvent.click(screen.getByRole("button", { name: "results.colors.question.customize" }));
    expect((screen.getByLabelText("1") as HTMLInputElement).value).toBe("#aaaaaa");
    fireEvent.input(screen.getByLabelText("2"), { target: { value: "#123456" } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const req = mutateAsync.mock.calls[0][0];
    expect(getSurveyApi).toHaveBeenCalledWith("s1");
    expect(req.title).toBe("Edited in builder");
    expect(req.settings?.colorPalette).toEqual(["#aaaaaa"]);
    expect(req.questions[0].title).toBe("Words renamed");
    expect(req.questions[0].settings).toMatchObject({ maxWords: 5 });
    const palette = req.questions[0].settings?.colorPalette as string[];
    expect(palette).toHaveLength(10);
    expect(palette[0]).toBe("#aaaaaa");
    expect(palette[1]).toBe("#123456");
    expect(req.questions.slice(1)).toEqual(latest.questions.slice(1));
  });

  it("resets the question to the survey colors", async () => {
    render(<QuestionColorsDialog survey={stale} questionId="q1" />);
    fireEvent.click(screen.getByRole("button", { name: "results.colors.question.customize" }));
    fireEvent.click(screen.getByRole("button", { name: "results.colors.question.useSurvey" }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const settings = mutateAsync.mock.calls[0][0].questions[0].settings;
    expect(settings).toEqual({ maxWords: 5 });
  });
});

describe("ChartColorsDialog", () => {
  it("saves the survey palette onto the latest survey", async () => {
    render(<ChartColorsDialog survey={stale} />);
    fireEvent.click(screen.getByRole("button", { name: "results.colors.customize" }));
    fireEvent.click(screen.getByRole("button", { name: "results.colors.useDefault" }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const req = mutateAsync.mock.calls[0][0];
    expect(req.settings?.colorPalette).toBeNull();
    expect(req.questions).toEqual(latest.questions);
  });
});
