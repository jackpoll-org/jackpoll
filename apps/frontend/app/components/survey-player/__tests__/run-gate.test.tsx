import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import type { PublicRun, Survey } from "@/app/types/survey";
import type { RunErrorCode } from "@/app/lib/survey/runs";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  search: "",
  mounts: 0,
  publicSurvey: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => "/s/abc",
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, string>) => (vars ? `${k}:${Object.keys(vars).join(",")}` : k),
    locale: "en",
  }),
}));
vi.mock("@/app/hooks/survey", () => ({
  usePublicSurvey: (id?: string, runId?: string) => mocks.publicSurvey(id, runId),
}));
vi.mock("../survey-player", () => ({
  SurveyPlayer: ({
    runId,
    onRunError,
  }: {
    runId?: string;
    onRunError: (c: RunErrorCode, next?: string) => void;
  }) => {
    useEffect(() => {
      mocks.mounts += 1;
    }, []);
    return (
    <div>
      <span data-testid="player">{runId ?? "none"}</span>
      <button onClick={() => onRunError("RUN_REQUIRED")}>required</button>
      <button onClick={() => onRunError("RUN_NOT_OPEN")}>notopen</button>
      <button onClick={() => onRunError("NO_OPEN_RUN", "2027-01-01T08:00:00Z")}>noopen</button>
    </div>
    );
  },
}));

import { useEffect } from "react";
import { AccessCodeRunGate, RunGate } from "../run-gate";

const run = (id: string, status: PublicRun["status"]): PublicRun => ({
  id,
  label: `Run ${id}`,
  opensAt: "2026-12-01T08:00:00Z",
  closesAt: "2027-01-01T08:00:00Z",
  status,
});

const survey = (runs?: PublicRun[], served?: PublicRun, hasRuns = !!runs?.length) =>
  ({ id: "s1", title: "T", runs, run: served ?? null, hasRuns }) as unknown as Survey;

beforeEach(() => {
  mocks.search = "";
  mocks.mounts = 0;
  mocks.publicSurvey.mockReturnValue({ data: undefined, refetch: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RunGate", () => {
  it("renders the player unchanged without runs", () => {
    render(<RunGate survey={survey()} />);
    expect(screen.getByTestId("player").textContent).toBe("none");
  });

  it("passes the run param to the player", () => {
    mocks.search = "run=b";
    render(<RunGate survey={survey([run("a", "open"), run("b", "open")], run("b", "open"))} />);
    expect(screen.getByTestId("player").textContent).toBe("b");
  });

  it("never plays a run whose content was not served", () => {
    mocks.search = "run=b";
    render(<RunGate survey={survey([run("a", "open"), run("b", "open")])} />);
    expect(screen.queryByTestId("player")).toBeNull();
    expect(screen.getByText("runs.player.notOpen")).toBeTruthy();
  });

  it("offers a picker when several runs are open and keeps other params", () => {
    mocks.search = "lang=de";
    render(<RunGate survey={survey([run("a", "open"), run("b", "open")])} />);
    expect(screen.queryByTestId("player")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Run b" }));
    expect(mocks.replace).toHaveBeenCalledWith("/s/abc?lang=de&run=b");
  });

  it("shows the next opening when no run is open", () => {
    render(<RunGate survey={survey([run("a", "scheduled")])} />);
    expect(screen.getByText("runs.player.opensOn:date")).toBeTruthy();
  });

  it("shows not open when nothing is scheduled for the requested run", () => {
    mocks.search = "run=gone";
    render(<RunGate survey={survey([run("a", "open")])} />);
    expect(screen.getByText("runs.player.notOpen")).toBeTruthy();
  });

  it("switches to the picker on RUN_REQUIRED and refreshes", async () => {
    const onRefresh = vi.fn();
    mocks.search = "run=a";
    render(
      <RunGate
        survey={survey([run("a", "open"), run("b", "open")], run("a", "open"))}
        onRefresh={onRefresh}
      />,
    );
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "required" })));
    expect(onRefresh).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Run a" })).toBeTruthy();
  });

  it("keeps the player and its answers mounted on RUN_NOT_OPEN, even after a refetch", async () => {
    const { rerender } = render(<RunGate survey={survey([run("a", "open")], run("a", "open"))} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "notopen" })));
    rerender(<RunGate survey={survey([], undefined, true)} />);
    expect(screen.getByText("runs.player.closedWhileFilling")).toBeTruthy();
    expect(screen.getByTestId("player").textContent).toBe("a");
    expect(mocks.mounts).toBe(1);
  });

  it("shows the next opening inline on NO_OPEN_RUN", async () => {
    render(<RunGate survey={survey([run("a", "open")], run("a", "open"))} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "noopen" })));
    expect(screen.getByText(/runs.player.opensOn:date/)).toBeTruthy();
    expect(screen.getByTestId("player")).toBeTruthy();
  });

  it("clears the error once a refetch shows the run open again", async () => {
    const { rerender } = render(<RunGate survey={survey([run("a", "open")], run("a", "open"))} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "notopen" })));
    rerender(<RunGate survey={survey([run("a", "open")], run("a", "open"))} />);
    expect(screen.queryByText("runs.player.closedWhileFilling")).toBeNull();
    expect(screen.getByTestId("player").textContent).toBe("a");
  });

  it("is not open when every run is closed", () => {
    render(<RunGate survey={survey([], undefined, true)} />);
    expect(screen.queryByTestId("player")).toBeNull();
    expect(screen.getByText("runs.player.notOpen")).toBeTruthy();
  });
});

describe("AccessCodeRunGate", () => {
  it("plays a survey without runs straight from the resolved code", () => {
    render(<AccessCodeRunGate survey={survey()} />);
    expect(mocks.publicSurvey).toHaveBeenCalledWith(undefined, undefined);
    expect(screen.getByTestId("player").textContent).toBe("none");
  });

  it("offers the picker and loads the picked run's content", async () => {
    const both = [run("a", "open"), run("b", "open")];
    mocks.publicSurvey.mockImplementation((_id?: string, runId?: string) => ({
      data: runId === "b" ? survey(both, run("b", "open")) : undefined,
      refetch: vi.fn(),
    }));
    render(<AccessCodeRunGate survey={survey(both)} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Run b" })));
    expect(mocks.publicSurvey).toHaveBeenLastCalledWith("s1", "b");
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.getByTestId("player").textContent).toBe("b");
  });
});
