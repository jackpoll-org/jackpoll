import { ApiError } from "./api";
import type { LiveSession, PublicRun, Survey } from "@/app/types/survey";

export type RunErrorCode = "RUN_REQUIRED" | "RUN_NOT_OPEN" | "NO_OPEN_RUN";

const RUN_ERROR_CODES: RunErrorCode[] = ["RUN_REQUIRED", "RUN_NOT_OPEN", "NO_OPEN_RUN"];

export type RunGate =
  | { kind: "play"; runId?: string }
  | { kind: "pick"; runs: PublicRun[] }
  | { kind: "notOpen"; opensAt?: string };

export function runErrorCode(err: unknown): RunErrorCode | null {
  if (!(err instanceof ApiError) || (err.status !== 409 && err.status !== 403)) return null;
  const text = `${err.reason ?? ""} ${err.message}`;
  return RUN_ERROR_CODES.find((code) => text.includes(code)) ?? null;
}

export function resolveRunGate(
  runs: PublicRun[] | undefined,
  runParam: string | null,
  hasRuns = false,
): RunGate {
  if (!runs?.length) return hasRuns ? { kind: "notOpen" } : { kind: "play" };
  if (runParam) {
    const run = runs.find((r) => r.id === runParam);
    if (run?.status === "open") return { kind: "play", runId: run.id };
    return { kind: "notOpen", opensAt: run?.status === "scheduled" ? run.opensAt : undefined };
  }
  const open = runs.filter((r) => r.status === "open");
  if (open.length === 1) return { kind: "play", runId: open[0].id };
  if (open.length > 1) return { kind: "pick", runs: open };
  const next = runs
    .filter((r) => r.status === "scheduled")
    .sort((a, b) => a.opensAt.localeCompare(b.opensAt))[0];
  return { kind: "notOpen", opensAt: next?.opensAt };
}

export function needsOpenRun(survey: Survey): boolean {
  return (!!survey.hasRuns || !!survey.run || !!survey.runs?.length) && survey.run?.status !== "open";
}

export function latestScheduledRunId(
  sessions: LiveSession[] | undefined,
  liveMode = false,
  now = Date.now(),
): string | null {
  if (liveMode) return null;
  const runs = (sessions ?? []).filter((s) => s.kind === "scheduled" && s.opensAt);
  if (runs.length === 0) return null;
  const opened = runs.filter((s) => Date.parse(s.opensAt!) <= now);
  return (opened.length ? opened : runs).reduce((a, b) =>
    Date.parse(b.opensAt!) > Date.parse(a.opensAt!) ? b : a,
  ).id;
}

export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string, original?: string): string {
  return original && value === toLocalInput(original) ? original : new Date(value).toISOString();
}

export function addOneYear(iso: string): string {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
}
