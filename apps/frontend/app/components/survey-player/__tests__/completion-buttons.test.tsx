import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import type { CompletionButton, Survey } from "@/app/types/survey";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/lib/survey/track", () => ({ trackEvent: vi.fn() }));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: "en" }),
}));
vi.mock("@/app/hooks/survey", () => ({
  useSubmitResponse: () => ({
    mutateAsync: vi.fn(async () => ({ id: "r1", submittedAt: "x", answers: [] })),
    isPending: false,
  }),
  useEditResponse: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSaveDraft: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteDraft: () => ({ mutateAsync: vi.fn(async () => undefined) }),
  useBeginToken: () => ({ data: undefined }),
  useHasResponded: () => ({ data: undefined }),
}));

import { SurveyPlayer } from "../survey-player";

function button(overrides: Partial<CompletionButton>): CompletionButton {
  return { id: crypto.randomUUID(), label: "Go", action: "url", enabled: true, ...overrides };
}

function survey(settings: Partial<Survey["settings"]>): Survey {
  return {
    id: "s1",
    title: "Quiz",
    status: "published",
    settings: { disableSaveLater: true, ...settings },
    questions: [{ id: "q1", type: "short-answer", title: "Name?", required: false, order: 0 }],
  } as unknown as Survey;
}

async function finish(settings: Partial<Survey["settings"]>) {
  render(<SurveyPlayer survey={survey(settings)} analytics />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "common.submit" }));
  });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("completion screen buttons", () => {
  it("keeps today's screen when nothing is configured", async () => {
    await finish({});
    expect(screen.getByRole("button", { name: "player.submitAnother" })).toBeTruthy();
    expect(screen.queryByTestId("completion-buttons")).toBeNull();
  });

  it("renders enabled, complete buttons in order and skips the rest", async () => {
    await finish({
      completionButtons: [
        button({ label: "Close quiz tab", action: "close" }),
        button({ label: "Directory", url: "https://example.com/quizzes" }),
        button({ label: "Hidden", url: "https://example.com", enabled: false }),
        button({ label: "Unsafe", url: "javascript:alert(1)" }),
        button({ label: "No link" }),
        button({ label: "  ", action: "close" }),
        button({ label: "Learn more", url: "https://example.com/learn", newTab: true }),
      ],
    });
    const group = screen.getByTestId("completion-buttons");
    const names = Array.from(group.querySelectorAll("a,button")).map((el) => el.textContent);
    expect(names).toEqual(["Close quiz tab", "Directory", "Learn more"]);
  });

  it("opens links in the same tab or a new tab as configured", async () => {
    await finish({
      completionButtons: [
        button({ label: "Same", url: "https://example.com/a" }),
        button({ label: "New", url: "https://example.com/b", newTab: true }),
      ],
    });
    const same = screen.getByRole("link", { name: "Same" });
    expect(same).toHaveAttribute("href", "https://example.com/a");
    expect(same).not.toHaveAttribute("target");
    const fresh = screen.getByRole("link", { name: "New" });
    expect(fresh).toHaveAttribute("target", "_blank");
    expect(fresh).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("opens same-tab links in a new tab and hides close inside an embed", async () => {
    vi.spyOn(window, "top", "get").mockReturnValue({} as Window);
    await finish({
      completionButtons: [
        button({ label: "Same", url: "https://example.com/a" }),
        button({ label: "Close", action: "close" }),
      ],
    });
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    const link = screen.getByRole("link", { name: "Same" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders labels as text, never as HTML", async () => {
    await finish({ completionButtons: [button({ label: "<b>bold</b>", action: "close" })] });
    expect(screen.getByRole("button", { name: "<b>bold</b>" })).toBeTruthy();
  });

  it("tries to close the tab and explains when the browser keeps it open", async () => {
    const close = vi.spyOn(window, "close").mockImplementation(() => {});
    await finish({ completionButtons: [button({ label: "Close", action: "close" })] });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(close).toHaveBeenCalled();
    expect(screen.queryByText("player.closeTabFallback")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("status")).toHaveTextContent("player.closeTabFallback");
  });

  it("restarts only when the participant clicks restart", async () => {
    await finish({ completionButtons: [button({ label: "Try again", action: "restart" })] });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("button", { name: "common.submit" })).toBeTruthy();
  });

  it("hides restart when another response is not permitted", async () => {
    await finish({
      onePerBrowser: true,
      completionButtons: [
        button({ label: "Try again", action: "restart" }),
        button({ label: "Close", action: "close" }),
      ],
    });
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  });

  it("renames or hides the submit another button", async () => {
    await finish({ submitAnotherLabel: "Once more" });
    expect(screen.getByRole("button", { name: "Once more" })).toBeTruthy();
    cleanup();
    await finish({ hideSubmitAnother: true });
    expect(screen.queryByRole("button", { name: "player.submitAnother" })).toBeNull();
  });
});
