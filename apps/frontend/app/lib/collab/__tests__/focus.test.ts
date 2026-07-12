import { describe, it, expect } from "vitest";
import { groupFocusByQuestion, type PresenceUser } from "../provider";

function peer(clientId: number, questionId?: string): PresenceUser {
  return {
    clientId,
    name: `U${clientId}`,
    color: "#123456",
    focus: questionId ? { questionId, field: "title" } : undefined,
  };
}

describe("groupFocusByQuestion", () => {
  it("groups peers by their focused question", () => {
    const map = groupFocusByQuestion([
      peer(1, "q1"),
      peer(2, "q1"),
      peer(3, "q2"),
    ]);
    expect(map.get("q1")?.map((p) => p.clientId)).toEqual([1, 2]);
    expect(map.get("q2")?.map((p) => p.clientId)).toEqual([3]);
  });

  it("skips peers without a focused question", () => {
    const map = groupFocusByQuestion([peer(1), peer(2, "q1")]);
    expect(map.size).toBe(1);
    expect(map.has("q1")).toBe(true);
  });
});
