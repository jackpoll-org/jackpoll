import { describe, expect, it } from "vitest";
import {
  fullOptionIds,
  isOptionFull,
  remainingFor,
  supportsQuota,
} from "@/app/lib/survey/quota";
import type { Question } from "@/app/types/survey";

function question(overrides: Partial<Question> = {}): Question {
  return {
    id: "q1",
    type: "multiple-choice",
    title: "Pick",
    required: false,
    order: 0,
    options: [
      { id: "a", label: "A", capacity: 1, used: 1 },
      { id: "b", label: "B", capacity: 2, used: 1 },
      { id: "c", label: "C" },
    ],
    ...overrides,
  };
}

describe("quota", () => {
  it("computes remaining and full state", () => {
    expect(remainingFor({ id: "a", label: "A", capacity: 1, used: 1 })).toBe(0);
    expect(remainingFor({ id: "b", label: "B", capacity: 3, used: 1 })).toBe(2);
    expect(remainingFor({ id: "c", label: "C" })).toBeNull();
    expect(isOptionFull({ id: "a", label: "A", capacity: 1, used: 1 })).toBe(true);
    expect(isOptionFull({ id: "c", label: "C" })).toBe(false);
  });

  it("only multiple-choice and dropdown support quotas", () => {
    expect(supportsQuota(question())).toBe(true);
    expect(supportsQuota(question({ type: "dropdown" }))).toBe(true);
    expect(supportsQuota(question({ type: "checkboxes" }))).toBe(false);
  });

  it("blocks full options but keeps the respondent's current pick selectable", () => {
    expect(fullOptionIds(question())).toEqual(["a"]);
    // "a" is full, but if it's the current selection it stays available.
    expect(fullOptionIds(question(), "a")).toEqual([]);
    // Uncapped question type yields nothing.
    expect(fullOptionIds(question({ type: "checkboxes" }))).toEqual([]);
  });
});
