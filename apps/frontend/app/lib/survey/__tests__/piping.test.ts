import { describe, it, expect } from "vitest";
import { hasPiping, resolvePiping } from "@/app/lib/survey/piping";
import type { Question } from "@/app/types/survey";

const questions: Question[] = [
  {
    id: "name",
    type: "short-answer",
    title: "Your name",
    required: false,
    order: 0,
  },
  {
    id: "fav",
    type: "multiple-choice",
    title: "Favorite?",
    required: false,
    order: 1,
    options: [
      { id: "o1", label: "Pizza" },
      { id: "o2", label: "Pasta" },
    ],
  },
];

describe("resolvePiping", () => {
  it("inserts a free-text answer", () => {
    expect(resolvePiping("Hi {{name}}!", { name: "Ada" }, questions)).toBe("Hi Ada!");
  });

  it("resolves a choice answer to its option label", () => {
    expect(
      resolvePiping("You picked {{fav}}", { fav: "o1" }, questions),
    ).toBe("You picked Pizza");
  });

  it("uses the fallback for empty or unknown references", () => {
    expect(resolvePiping("Hi {{name}}", {}, questions, "friend")).toBe("Hi friend");
    expect(resolvePiping("Hi {{missing}}", {}, questions)).toBe("Hi ");
  });

  it("leaves text without tokens unchanged", () => {
    expect(resolvePiping("No tokens here", {}, questions)).toBe("No tokens here");
  });
});

describe("hasPiping", () => {
  it("detects tokens", () => {
    expect(hasPiping("Hello {{x}}")).toBe(true);
    expect(hasPiping("plain")).toBe(false);
  });
});
