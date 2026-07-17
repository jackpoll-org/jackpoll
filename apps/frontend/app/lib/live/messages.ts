// Presenter-paced live mode (#): control messages the presenter broadcasts to
// participants over the results WebSocket. Shapes:
//   {"live":{"index":N,"phase":"lobby|countdown|question|reveal|results"}}  — presenter position
//   {"join":{"name":"..."}}                                  — participant check-in

export type LivePhase = "lobby" | "countdown" | "question" | "reveal" | "results";

export interface LiveState {
  index: number;
  phase: LivePhase;
}

/** Normalize an arbitrary phase string to a known LivePhase (default "question"). */
export function normalizeLivePhase(phase: unknown): LivePhase {
  return phase === "results"
    ? "results"
    : phase === "lobby"
      ? "lobby"
      : phase === "countdown"
        ? "countdown"
        : phase === "reveal"
          ? "reveal"
          : "question";
}

/** Parse a presenter live control message, or null if the frame isn't one. */
export function parseLiveMessage(data: string): LiveState | null {
  if (!data || data[0] !== "{") return null;
  try {
    const parsed = JSON.parse(data) as { live?: { index?: unknown; phase?: unknown } };
    const live = parsed?.live;
    if (live && typeof live.index === "number") {
      return { index: live.index, phase: normalizeLivePhase(live.phase) };
    }
  } catch {
    // Not JSON / not a live message.
  }
  return null;
}

/** Parse a participant lobby check-in, returning the nickname or null. */
export function parseJoinMessage(data: string): string | null {
  if (!data || data[0] !== "{") return null;
  try {
    const parsed = JSON.parse(data) as { join?: { name?: unknown } };
    const name = parsed?.join?.name;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
}
