import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
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

function q(id: string, sectionId: string | null = null, type: Question["type"] = "short-answer"): Question {
  return { id, type, title: id, required: false, order: 0, sectionId };
}

function survey(questions: Question[], settings: Partial<Survey["settings"]> = {}, withSections = false): Survey {
  return {
    id: "s1",
    title: "S",
    status: "published",
    settings: { showProgressBar: true, disableSaveLater: true, ...settings },
    questions,
    sections: withSections
      ? [
          { id: "p1", title: "One", order: 0 },
          { id: "p2", title: "Two", order: 1 },
        ]
      : undefined,
  } as unknown as Survey;
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function bar() {
  return screen.getByRole("progressbar");
}

describe("SurveyPlayer progress", () => {
  it("shows page and answered count on multi-page surveys", () => {
    const s = survey([q("a", "p1"), q("b", "p1"), q("c", "p2")], {}, true);
    render(<SurveyPlayer survey={s} initialAnswers={{ c: "done" }} />);
    const label = "player.progress.page(1/2) · player.progress.answered(1/3)";
    expect(screen.getByText(label)).toBeTruthy();
    expect(bar()).toHaveAccessibleName(label);
    expect(bar()).toHaveAttribute("aria-valuenow", "1");
    expect(bar()).toHaveAttribute("aria-valuemax", "3");

    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "x" } });
    expect(bar()).toHaveAttribute("aria-valuenow", "2");
  });

  it("shows only the answered count on a single page", () => {
    render(<SurveyPlayer survey={survey([q("intro", null, "content"), q("a"), q("b")])} />);
    expect(screen.getByText("player.progress.answered(0/2)")).toBeTruthy();
    expect(bar()).toHaveAttribute("aria-valuenow", "0");
  });

  it("numbers questions in conversational mode", () => {
    render(
      <SurveyPlayer
        survey={survey([q("a"), q("b"), q("c")], { conversational: true })}
        initialAnswers={{ a: "x" }}
      />,
    );
    expect(screen.getByText("player.progress.question(1/3) · player.progress.answeredOnly(1)")).toBeTruthy();
  });

  it("is hidden when the setting is off or nothing can be answered", () => {
    render(<SurveyPlayer survey={survey([q("a")], { showProgressBar: false })} />);
    expect(screen.queryByRole("progressbar")).toBeNull();
    cleanup();
    render(<SurveyPlayer survey={survey([q("intro", null, "content")])} />);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});
