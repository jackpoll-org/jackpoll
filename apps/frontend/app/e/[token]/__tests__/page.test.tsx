import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { PublicRun, Survey } from "@/app/types/survey";

const mocks = vi.hoisted(() => ({
  edit: vi.fn(),
  publicSurvey: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useParams: () => ({ token: "tok" }) }));
vi.mock("@/app/i18n/context", () => ({ useTranslation: () => ({ t: (k: string) => k, locale: "en" }) }));
vi.mock("@/app/components/legal/legal-links", () => ({ LegalLinks: () => null }));
vi.mock("@/app/hooks/survey", () => ({
  useResponseForEdit: () => mocks.edit(),
  usePublicSurvey: (id?: string, runId?: string) => mocks.publicSurvey(id, runId),
}));
vi.mock("@/app/components/survey-player/survey-player", () => ({
  SurveyPlayer: () => <div data-testid="player" />,
}));

import EditResponsePage from "../page";

const run = (status: PublicRun["status"]): PublicRun => ({
  id: "run-a",
  label: "A",
  opensAt: "2026-12-01T08:00:00Z",
  closesAt: "2027-01-01T08:00:00Z",
  status,
});

const editView = (runId: string | null) => ({
  isLoading: false,
  isError: false,
  data: { surveyId: "s1", runId, response: { answers: [] } },
});

const surveyResult = (survey: Partial<Survey>) => ({ isLoading: false, isError: false, data: survey });

describe("EditResponsePage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads the survey for the response's run", () => {
    mocks.edit.mockReturnValue(editView("run-a"));
    mocks.publicSurvey.mockReturnValue(surveyResult({ hasRuns: true, run: run("open"), questions: [] }));
    render(<EditResponsePage />);
    expect(mocks.publicSurvey).toHaveBeenCalledWith("s1", "run-a");
    expect(screen.getByTestId("player")).toBeTruthy();
  });

  it("never renders an empty form when the survey has runs but none is served", () => {
    mocks.edit.mockReturnValue(editView(null));
    mocks.publicSurvey.mockReturnValue(surveyResult({ hasRuns: true, runs: [run("open")], questions: [] }));
    render(<EditResponsePage />);
    expect(screen.queryByTestId("player")).toBeNull();
    expect(screen.getByText("runs.player.notOpen")).toBeTruthy();
  });
});
