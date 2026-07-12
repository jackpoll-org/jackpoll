// Presenter-paced live mode (#): control messages the presenter broadcasts to
// participants over the results WebSocket. Shapes:
//   {"live":{"index":N,"phase":"lobby|question|results"}}  — presenter position
//   {"join":{"name":"..."}}                                  — participant check-in

export type LivePhase = "lobby" | "question" | "reveal" | "results";

export interface LiveState {
  index: number;
  phase: LivePhase;
}

/** Parse a presenter live control message, or null if the frame isn't one. */
export function parseLiveMessage(data: string): LiveState | null {
  if (!data || data[0] !== "{") return null;
  try {
    const parsed = JSON.parse(data) as { live?: { index?: unknown; phase?: unknown } };
    const live = parsed?.live;
    if (live && typeof live.index === "number") {
      const phase: LivePhase =
        live.phase === "results"
          ? "results"
          : live.phase === "lobby"
            ? "lobby"
            : live.phase === "reveal"
              ? "reveal"
              : "question";
      return { index: live.index, phase };
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
