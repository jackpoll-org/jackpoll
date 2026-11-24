import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { Question, Survey } from "@/app/types/survey";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/lib/survey/track", () => ({ trackEvent: vi.fn() }));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({
    t: (k: string, p?: Record<string, unknown>) => (p ? `${k}(${Object.values(p).join("/")})` : k),
    locale: "en",
  }),
}));
vi.mock("@/app/hooks/survey", () => ({
  useSubmitResponse: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useEditResponse: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSaveDraft: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteDraft: () => ({ mutateAsync: vi.fn(async () => undefined) }),
  useBeginToken: () => ({ data: undefined }),
  useHasResponded: () => ({ data: undefined }),
}));

import { SurveyPlayer } from "../survey-player";

const titles = Array.from({ length: 8 }, (_, i) => `Question ${i}`);
const labels = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"];

function survey(settings: Partial<Survey["settings"]>): Survey {
  const questions: Question[] = titles.map((title, i) => ({
    id: `q${i}`,
    type: "multiple-choice",
    title,
    required: false,
    order: i,
    options: labels.map((label) => ({ id: `q${i}-${label}`, label })),
  }));
  return {
    id: "s1",
    title: "S",
    status: "published",
    settings: { disableSaveLater: true, ...settings },
    questions,
  } as unknown as Survey;
}

function order(words: string[]): string[] {
  const text = document.body.textContent ?? "";
  return words.toSorted((a, b) => text.indexOf(a) - text.indexOf(b));
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("SurveyPlayer shuffling", () => {
  it("keeps the respondent's own question and option order across remounts", () => {
    const s = survey({ shuffleQuestions: true, shuffleOptions: true });
    render(<SurveyPlayer survey={s} />);
    const questions = order(titles);
    const options = order(labels);
    expect(questions).not.toEqual(titles);
    expect(options).not.toEqual(labels);
    cleanup();

    render(<SurveyPlayer survey={s} />);
    expect(order(titles)).toEqual(questions);
    expect(order(labels)).toEqual(options);
  });

  it("keeps the survey's order in live mode", () => {
    render(<SurveyPlayer survey={survey({ shuffleQuestions: true, shuffleOptions: true, liveMode: true })} />);
    expect(order(titles)).toEqual(titles);
    expect(order(labels)).toEqual(labels);
  });

  it("keeps the survey's order when shuffling is off", () => {
    render(<SurveyPlayer survey={survey({})} />);
    expect(screen.getAllByRole("group").length).toBe(titles.length);
    expect(order(titles)).toEqual(titles);
  });
});
