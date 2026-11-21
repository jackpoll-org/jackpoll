import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import type { LiveSession } from "@/app/types/survey";

const mocks = vi.hoisted(() => ({
  sessions: [] as LiveSession[] | undefined,
  sessionsPending: false,
  liveMode: false,
  results: vi.fn(),
  responses: vi.fn(),
}));

vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: "en" }),
}));
vi.mock("@/app/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: ReactNode }) => (
    <select value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));
vi.mock("@/app/hooks/survey", () => ({
  useSurvey: () => ({
    data: { id: "s1", title: "S", settings: { liveMode: mocks.liveMode }, questions: [] },
  }),
  useCanEditSurvey: () => false,
  useSurveyResults: (_id: string, _preview: boolean, sessionId: string | null, enabled: boolean) => {
    if (enabled) mocks.results(sessionId);
    return { isLoading: true };
  },
  useResponses: (_id: string, sessionId: string | null, enabled: boolean) => {
    if (enabled) mocks.responses(sessionId);
    return { data: [] };
  },
  useDeletePreviewResponses: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/app/hooks/live", () => ({
  useLiveSessions: () => ({ data: mocks.sessions, isPending: mocks.sessionsPending }),
}));
vi.mock("@/app/hooks/results-live", () => ({ useLiveResultsSocket: () => undefined }));
vi.mock("../responses-panel", () => ({ ResponsesPanel: () => null }));
vi.mock("../analytics-panel", () => ({ AnalyticsPanel: () => null }));

import { ResultsDashboard } from "../results-dashboard";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.sessionsPending = false;
  mocks.liveMode = false;
});

const run = (id: string, opensAt: string): LiveSession => ({
  id,
  kind: "scheduled",
  label: id,
  opensAt,
  startedAt: "",
  responses: 1,
  players: 0,
});

describe("ResultsDashboard with scheduled runs", () => {
  it("defaults to the latest run and can switch to all runs", () => {
    mocks.sessions = [run("old", "2025-09-01T00:00:00Z"), run("new", "2026-09-01T00:00:00Z")];
    render(<ResultsDashboard surveyId="s1" />);
    expect(mocks.results).toHaveBeenLastCalledWith("new");
    expect(mocks.responses).toHaveBeenLastCalledWith("new");

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "__all__" } });
    expect(mocks.results).toHaveBeenLastCalledWith(null);
    expect(mocks.responses).toHaveBeenLastCalledWith(null);
  });

  it("waits for the sessions before loading results", () => {
    mocks.sessions = undefined;
    mocks.sessionsPending = true;
    render(<ResultsDashboard surveyId="s1" />);
    expect(mocks.results).not.toHaveBeenCalled();
    expect(mocks.responses).not.toHaveBeenCalled();
  });

  it("ignores leftover runs of a live quiz", () => {
    mocks.liveMode = true;
    mocks.sessions = [run("left", "2025-09-01T00:00:00Z")];
    render(<ResultsDashboard surveyId="s1" />);
    expect(mocks.results).toHaveBeenLastCalledWith(null);
  });

  it("shows all responses without scheduled runs", () => {
    mocks.sessions = [];
    render(<ResultsDashboard surveyId="s1" />);
    expect(mocks.results).toHaveBeenLastCalledWith(null);
  });
});
