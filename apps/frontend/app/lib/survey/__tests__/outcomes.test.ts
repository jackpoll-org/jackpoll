import { describe, it, expect } from "vitest";
import { matchOutcome } from "../outcomes";
import type { Outcome } from "@/app/types/survey";

const outcomes: Outcome[] = [
  { id: "low", title: "Low", maxScore: 3 },
  { id: "mid", title: "Mid", minScore: 4, maxScore: 7 },
  { id: "high", title: "High", minScore: 8 },
];

describe("matchOutcome", () => {
  it("returns null without outcomes or score", () => {
    expect(matchOutcome(undefined, 5)).toBeNull();
    expect(matchOutcome(outcomes, null)).toBeNull();
    expect(matchOutcome([], 5)).toBeNull();
  });

  it("matches by inclusive score range with open-ended bounds", () => {
    expect(matchOutcome(outcomes, 0)?.id).toBe("low");
    expect(matchOutcome(outcomes, 3)?.id).toBe("low");
    expect(matchOutcome(outcomes, 4)?.id).toBe("mid");
    expect(matchOutcome(outcomes, 7)?.id).toBe("mid");
    expect(matchOutcome(outcomes, 8)?.id).toBe("high");
    expect(matchOutcome(outcomes, 100)?.id).toBe("high");
  });

  it("returns null when no range contains the score", () => {
    expect(matchOutcome([{ id: "x", title: "X", minScore: 10 }], 5)).toBeNull();
  });
});
