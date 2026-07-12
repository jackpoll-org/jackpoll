import { describe, it, expect } from "vitest";
import { resolveFollowTarget, type PresenceUser } from "../provider";

function peer(clientId: number, questionId?: string): PresenceUser {
  return {
    clientId,
    name: `U${clientId}`,
    color: "#abcdef",
    focus: questionId ? { questionId, field: "title" } : undefined,
  };
}

describe("resolveFollowTarget", () => {
  it("returns null when not following anyone", () => {
    expect(resolveFollowTarget([peer(1, "q1")], null)).toBeNull();
  });

  it("returns the followed peer and their question", () => {
    const t = resolveFollowTarget([peer(1, "q1"), peer(2, "q2")], 2);
    expect(t?.peer.clientId).toBe(2);
    expect(t?.questionId).toBe("q2");
  });

  it("returns a null questionId when the peer has no focus", () => {
    const t = resolveFollowTarget([peer(3)], 3);
    expect(t?.peer.clientId).toBe(3);
    expect(t?.questionId).toBeNull();
  });

  it("returns null when the followed peer has left (auto-stop)", () => {
    expect(resolveFollowTarget([peer(1, "q1")], 99)).toBeNull();
  });
});
