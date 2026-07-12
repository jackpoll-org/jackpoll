import { describe, it, expect } from "vitest";
import { isQuizGame } from "../quiz-game";

describe("isQuizGame", () => {
  it("is a game only when it is both live and a quiz", () => {
    expect(isQuizGame({ isQuiz: true, liveMode: true })).toBe(true);
    expect(isQuizGame({ isQuiz: true, liveMode: false })).toBe(false);
    expect(isQuizGame({ isQuiz: false, liveMode: true })).toBe(false);
    expect(isQuizGame({ isQuiz: false })).toBe(false);
    expect(isQuizGame({ isQuiz: true })).toBe(false);
  });
});
