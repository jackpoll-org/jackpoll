import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { Survey } from "@/app/types/survey";

const updateSettings = vi.fn();
let survey: Survey;

vi.mock("../builder-context", () => ({
  useBuilder: () => ({ survey, updateSettings }),
}));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: "en" }),
}));
vi.mock("@/app/hooks/auth", () => ({
  useCurrentUser: () => ({ data: { id: "owner-1", name: "Ada" } }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: "<svg fill=\"#024DB2\"/>" }),
}));

import { OgPreviewCard } from "../og-preview-card";

class FixedWidthObserver {
  constructor(private cb: ResizeObserverCallback) {}
  observe() {
    this.cb([{ contentRect: { width: 600 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  disconnect() {}
}

function baseSurvey(settings: Partial<Survey["settings"]> = {}): Survey {
  return {
    id: "s1",
    ownerId: "owner-1",
    title: "Team survey",
    description: "Kurz und knapp",
    status: "draft",
    settings: { isQuiz: false, ...settings } as Survey["settings"],
    questions: [],
    createdAt: "",
    updatedAt: "",
  };
}

describe("OgPreviewCard", () => {
  beforeEach(() => {
    cleanup();
    updateSettings.mockClear();
    vi.stubGlobal("ResizeObserver", FixedWidthObserver);
  });

  it("previews title and description, owner hidden by default", () => {
    survey = baseSurvey();
    render(<OgPreviewCard />);
    expect(screen.getAllByText("Team survey").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Kurz und knapp").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Ada/)).toBeNull();
  });

  it("shows the current owner's name once enabled", () => {
    survey = baseSurvey({ ogShowOwner: true, ogShowDescription: false });
    render(<OgPreviewCard />);
    expect(screen.getAllByText("von Ada").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Kurz und knapp")).toHaveLength(1);
  });

  it("saves a toggle change to the survey settings", () => {
    survey = baseSurvey();
    render(<OgPreviewCard />);
    fireEvent.click(screen.getByRole("switch", { name: "builder.og.showTitle" }));
    expect(updateSettings).toHaveBeenCalledWith({ ogShowTitle: false });
  });

  it("only offers the question switch where the design shows a choice question", () => {
    const choice = { id: "q1", type: "multiple-choice", title: "Pick", required: false, order: 0, options: [{ id: "a", label: "A" }] };
    survey = { ...baseSurvey(), questions: [choice] } as Survey;
    render(<OgPreviewCard />);
    expect(screen.getByRole("switch", { name: "builder.og.showQuestion" })).toBeTruthy();
    cleanup();

    survey = { ...baseSurvey({ ogStyle: "split" }), questions: [choice] } as Survey;
    render(<OgPreviewCard />);
    expect(screen.queryByRole("switch", { name: "builder.og.showQuestion" })).toBeNull();
    cleanup();

    survey = baseSurvey();
    render(<OgPreviewCard />);
    expect(screen.queryByRole("switch", { name: "builder.og.showQuestion" })).toBeNull();
  });

  it("lets only the owner publish their name", () => {
    survey = { ...baseSurvey(), ownerId: "someone-else" };
    render(<OgPreviewCard />);
    expect((screen.getByRole("switch", { name: "builder.og.showOwner" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("offers every design and saves the chosen one", () => {
    survey = baseSurvey();
    render(<OgPreviewCard />);
    expect(screen.getByRole("radio", { name: "builder.og.style.classic" }).getAttribute("data-state")).toBe("checked");
    fireEvent.click(screen.getByRole("radio", { name: "builder.og.style.spotlight" }));
    expect(updateSettings).toHaveBeenCalledWith({ ogStyle: "spotlight" });
  });
});
