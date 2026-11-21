import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act, within } from "@testing-library/react";
import type { Run, Survey } from "@/app/types/survey";

const mocks = vi.hoisted(() => ({
  runs: [] as Run[],
  userId: "owner-1",
  create: vi.fn(async () => ({})),
  update: vi.fn(async () => ({})),
  close: vi.fn(async () => ({})),
  duplicate: vi.fn(async () => ({})),
  remove: vi.fn(async () => undefined),
  writeText: vi.fn(async () => undefined),
}));

const survey = { id: "s1", ownerId: "owner-1", status: "published", settings: {} } as unknown as Survey & {
  settings: { requireRespondentToken?: boolean };
};

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, string>) =>
      vars ? `${k}:${Object.values(vars).join(",")}` : k,
    locale: "en",
  }),
}));
vi.mock("../builder-context", () => ({ useBuilder: () => ({ survey }) }));
vi.mock("@/app/hooks/auth", () => ({ useCurrentUser: () => ({ data: { id: mocks.userId } }) }));
vi.mock("@/app/hooks/survey", () => ({ useShareLink: () => ({ data: { slug: "abc" } }) }));
vi.mock("@/app/hooks/runs", () => ({
  useRuns: () => ({ data: mocks.runs, isLoading: false, isError: false }),
  useCreateRun: () => ({ mutateAsync: mocks.create, isPending: false }),
  useUpdateRun: () => ({ mutateAsync: mocks.update, isPending: false }),
  useCloseRun: () => ({ mutateAsync: mocks.close, isPending: false }),
  useDuplicateRun: () => ({ mutateAsync: mocks.duplicate, isPending: false }),
  useDeleteRun: () => ({ mutateAsync: mocks.remove, isPending: false }),
}));

import { RunOpenBanner, RunsCard } from "../runs-card";

const baseRun: Run = {
  id: "r1",
  label: "2026/27",
  opensAt: "2026-09-01T08:00:00.000Z",
  closesAt: "2027-07-01T08:00:00.000Z",
  closedAt: null,
  status: "open",
  responseCount: 3,
  snapshotAt: null,
};

beforeEach(() => {
  mocks.runs = [baseRun];
  mocks.userId = "owner-1";
  vi.spyOn(window, "confirm").mockReturnValue(true);
  Object.assign(navigator, { clipboard: { writeText: mocks.writeText } });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function fill(label: string, opens: string, closes: string) {
  fireEvent.change(screen.getByLabelText("runs.dialog.label"), { target: { value: label } });
  fireEvent.change(screen.getByLabelText("runs.dialog.opensAt"), { target: { value: opens } });
  fireEvent.change(screen.getByLabelText("runs.dialog.closesAt"), { target: { value: closes } });
}

async function save() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
  });
}

describe("RunsCard", () => {
  it("lists runs with status and response count", () => {
    render(<RunsCard />);
    const row = screen.getByTestId("run-row");
    expect(within(row).getByText("2026/27")).toBeTruthy();
    expect(within(row).getByText("runs.status.open")).toBeTruthy();
    expect(row.textContent).toContain("runs.responses:3");
  });

  it("creates a run with ISO times from the local inputs", async () => {
    render(<RunsCard />);
    fireEvent.click(screen.getByRole("button", { name: "runs.add" }));
    fill(" Autumn ", "2026-10-01T09:00", "2026-10-31T17:00");
    await save();
    expect(mocks.create).toHaveBeenCalledWith({
      label: "Autumn",
      opensAt: new Date("2026-10-01T09:00").toISOString(),
      closesAt: new Date("2026-10-31T17:00").toISOString(),
    });
  });

  it("rejects an end before the start", async () => {
    render(<RunsCard />);
    fireEvent.click(screen.getByRole("button", { name: "runs.add" }));
    fill("Bad", "2026-10-31T09:00", "2026-10-01T09:00");
    await save();
    expect(screen.getByRole("alert").textContent).toBe("runs.dialog.order");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("edits a run", async () => {
    render(<RunsCard />);
    fireEvent.click(screen.getByRole("button", { name: "common.edit" }));
    expect(screen.getByLabelText("runs.dialog.label")).toHaveProperty("value", "2026/27");
    fireEvent.change(screen.getByLabelText("runs.dialog.label"), { target: { value: "Renamed" } });
    await save();
    expect(mocks.update).toHaveBeenCalledWith({
      id: "r1",
      data: expect.objectContaining({ label: "Renamed", opensAt: baseRun.opensAt }),
    });
  });

  it("keeps unchanged times exact to the second when editing", async () => {
    mocks.runs = [{ ...baseRun, opensAt: "2026-09-01T08:00:42.500Z", closesAt: "2027-07-01T08:00:59Z" }];
    render(<RunsCard />);
    fireEvent.click(screen.getByRole("button", { name: "common.edit" }));
    fireEvent.change(screen.getByLabelText("runs.dialog.label"), { target: { value: "Renamed" } });
    await save();
    expect(mocks.update).toHaveBeenCalledWith({
      id: "r1",
      data: { label: "Renamed", opensAt: "2026-09-01T08:00:42.500Z", closesAt: "2027-07-01T08:00:59Z" },
    });
  });

  it("notes that the survey window bounds runs and tokens are shared", () => {
    render(<RunsCard />);
    expect(screen.getByText("runs.surveyWindowNote")).toBeTruthy();
    expect(screen.queryByText("runs.tokensNote")).toBeNull();
    cleanup();
    survey.settings.requireRespondentToken = true;
    render(<RunsCard />);
    expect(screen.getByText("runs.tokensNote")).toBeTruthy();
    survey.settings.requireRespondentToken = undefined;
  });

  it("duplicates with the window moved one year ahead", async () => {
    render(<RunsCard />);
    fireEvent.click(screen.getByRole("button", { name: "runs.duplicate" }));
    await save();
    expect(mocks.duplicate).toHaveBeenCalledWith({
      id: "r1",
      data: {
        label: "2026/27",
        opensAt: "2027-09-01T08:00:00.000Z",
        closesAt: "2028-07-01T08:00:00.000Z",
      },
    });
  });

  it("closes an open run", async () => {
    render(<RunsCard />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "runs.close" }));
    });
    expect(mocks.close).toHaveBeenCalledWith("r1");
  });

  it("disables delete for a run with responses and deletes an empty one", async () => {
    mocks.runs = [baseRun, { ...baseRun, id: "r2", responseCount: 0, status: "scheduled" }];
    render(<RunsCard />);
    const [withResponses, empty] = screen.getAllByRole("button", { name: "common.delete" });
    expect(withResponses).toHaveProperty("disabled", true);
    await act(async () => {
      fireEvent.click(empty);
    });
    expect(mocks.remove).toHaveBeenCalledWith("r2");
  });

  it("hides delete from editors", () => {
    mocks.userId = "editor-1";
    render(<RunsCard />);
    expect(screen.queryByRole("button", { name: "common.delete" })).toBeNull();
  });

  it("copies the run link", async () => {
    render(<RunsCard />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "runs.copyLink" }));
    });
    expect(mocks.writeText).toHaveBeenCalledWith(`${window.location.origin}/s/abc?run=r1`);
  });
});

describe("RunOpenBanner", () => {
  it("shows while a run is open", () => {
    render(<RunOpenBanner surveyId="s1" />);
    expect(screen.getByText("runs.openBanner")).toBeTruthy();
  });

  it("stays hidden otherwise", () => {
    mocks.runs = [{ ...baseRun, status: "closed" }];
    render(<RunOpenBanner surveyId="s1" />);
    expect(screen.queryByText("runs.openBanner")).toBeNull();
  });
});
