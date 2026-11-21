import { describe, it, expect } from "vitest";
import { ApiError } from "../api";
import {
  addOneYear,
  fromLocalInput,
  latestScheduledRunId,
  needsOpenRun,
  resolveRunGate,
  runErrorCode,
  toLocalInput,
} from "../runs";
import type { LiveSession, PublicRun, Survey } from "@/app/types/survey";

const run = (id: string, status: PublicRun["status"], opensAt = "2026-09-01T08:00:00Z"): PublicRun => ({
  id,
  label: id,
  opensAt,
  closesAt: "2027-07-01T08:00:00Z",
  status,
});

describe("runErrorCode", () => {
  it("reads the code from the error reason or message of a 409", () => {
    expect(runErrorCode(new ApiError("Pick one", 409, "RUN_REQUIRED"))).toBe("RUN_REQUIRED");
    expect(runErrorCode(new ApiError("RUN_NOT_OPEN", 409))).toBe("RUN_NOT_OPEN");
    expect(runErrorCode(new ApiError("Not open", 403, "NO_OPEN_RUN"))).toBe("NO_OPEN_RUN");
  });

  it("ignores other errors", () => {
    expect(runErrorCode(new ApiError("RUN_REQUIRED", 400))).toBeNull();
    expect(runErrorCode(new ApiError("Quota", 409))).toBeNull();
    expect(runErrorCode(new Error("RUN_REQUIRED"))).toBeNull();
  });
});

describe("resolveRunGate", () => {
  it("plays unchanged when the survey has no runs", () => {
    expect(resolveRunGate(undefined, null)).toEqual({ kind: "play" });
    expect(resolveRunGate([], "x")).toEqual({ kind: "play" });
  });

  it("is not open when the survey has runs but none is visible", () => {
    expect(resolveRunGate([], null, true)).toEqual({ kind: "notOpen" });
    expect(resolveRunGate(undefined, "x", true)).toEqual({ kind: "notOpen" });
  });

  it("plays the requested run when it is open", () => {
    expect(resolveRunGate([run("a", "open"), run("b", "open")], "b")).toEqual({
      kind: "play",
      runId: "b",
    });
  });

  it("reports a requested run that is not open", () => {
    expect(resolveRunGate([run("a", "scheduled")], "a")).toEqual({
      kind: "notOpen",
      opensAt: "2026-09-01T08:00:00Z",
    });
    expect(resolveRunGate([run("a", "open")], "gone")).toEqual({ kind: "notOpen" });
  });

  it("uses the only open run without a param", () => {
    expect(resolveRunGate([run("a", "open"), run("b", "scheduled")], null)).toEqual({
      kind: "play",
      runId: "a",
    });
  });

  it("asks to pick when several runs are open", () => {
    const gate = resolveRunGate([run("a", "open"), run("b", "open")], null);
    expect(gate.kind).toBe("pick");
  });

  it("names the next scheduled opening when none is open", () => {
    expect(
      resolveRunGate(
        [run("late", "scheduled", "2027-09-01T08:00:00Z"), run("soon", "scheduled", "2026-12-01T08:00:00Z")],
        null,
      ),
    ).toEqual({ kind: "notOpen", opensAt: "2026-12-01T08:00:00Z" });
  });
});

describe("latestScheduledRunId", () => {
  const session = (id: string, kind: "live" | "scheduled", opensAt?: string): LiveSession => ({
    id,
    kind,
    opensAt,
    startedAt: "2026-01-01T00:00:00Z",
    responses: 0,
    players: 0,
  });

  it("picks the scheduled run that opens last", () => {
    expect(
      latestScheduledRunId([
        session("old", "scheduled", "2025-09-01T00:00:00Z"),
        session("new", "scheduled", "2026-09-01T00:00:00Z"),
        session("live", "live"),
      ]),
    ).toBe("new");
  });

  it("prefers the latest run that has already opened over future ones", () => {
    const now = Date.parse("2026-10-01T00:00:00Z");
    const sessions = [
      session("opened", "scheduled", "2026-09-01T00:00:00Z"),
      session("future", "scheduled", "2026-12-01T00:00:00Z"),
    ];
    expect(latestScheduledRunId(sessions, false, now)).toBe("opened");
    expect(latestScheduledRunId([sessions[1]], false, now)).toBe("future");
  });

  it("is null without scheduled runs", () => {
    expect(latestScheduledRunId([session("live", "live")])).toBeNull();
    expect(latestScheduledRunId(undefined)).toBeNull();
  });

  it("is null for live quizzes with leftover runs", () => {
    expect(latestScheduledRunId([session("left", "scheduled", "2025-09-01T00:00:00Z")], true)).toBeNull();
  });
});

describe("needsOpenRun", () => {
  const of = (patch: Partial<Survey>) => patch as Survey;

  it("asks for an open run whenever the survey uses runs", () => {
    expect(needsOpenRun(of({ hasRuns: true, runs: [], run: null }))).toBe(true);
    expect(needsOpenRun(of({ runs: [], run: run("a", "closed") }))).toBe(true);
    expect(needsOpenRun(of({ runs: [run("a", "scheduled")] }))).toBe(true);
  });

  it("lets an open run or a survey without runs through", () => {
    expect(needsOpenRun(of({ hasRuns: true, runs: [run("a", "open")], run: run("a", "open") }))).toBe(false);
    expect(needsOpenRun(of({ hasRuns: false, runs: [] }))).toBe(false);
  });
});

describe("date helpers", () => {
  it("keeps the original instant when the input is unchanged", () => {
    const original = "2026-09-01T08:05:42.123Z";
    expect(fromLocalInput(toLocalInput(original), original)).toBe(original);
    const changed = new Date(2026, 8, 2, 9, 0);
    expect(fromLocalInput(toLocalInput(changed.toISOString()), original)).toBe(changed.toISOString());
  });

  it("formats a datetime-local value in local time", () => {
    const local = new Date(2026, 8, 1, 8, 5);
    expect(toLocalInput(local.toISOString())).toBe("2026-09-01T08:05");
    expect(toLocalInput("nope")).toBe("");
  });

  it("moves an instant one year ahead", () => {
    expect(addOneYear("2026-09-01T08:00:00.000Z")).toBe("2027-09-01T08:00:00.000Z");
  });
});
