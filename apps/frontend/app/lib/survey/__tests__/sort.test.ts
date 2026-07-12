import { describe, it, expect } from "vitest";
import { sortSurveys } from "../sort";
import type { Survey } from "@/app/types/survey";

function survey(
  id: string,
  opts: Partial<Pick<Survey, "title" | "createdAt" | "updatedAt" | "sortPosition">> = {},
): Survey {
  return {
    id,
    ownerId: "o1",
    title: opts.title ?? id,
    status: "draft",
    settings: {} as Survey["settings"],
    questions: [],
    sortPosition: opts.sortPosition,
    createdAt: opts.createdAt ?? "2026-01-01T00:00:00Z",
    updatedAt: opts.updatedAt ?? "2026-01-01T00:00:00Z",
  };
}

describe("sortSurveys", () => {
  it("orders by manual sortPosition ascending", () => {
    const list = [
      survey("a", { sortPosition: 2 }),
      survey("b", { sortPosition: 0 }),
      survey("c", { sortPosition: 1 }),
    ];
    expect(sortSurveys(list, "manual").map((s) => s.id)).toEqual(["b", "c", "a"]);
  });

  it("places un-positioned surveys last under manual sort", () => {
    const list = [
      survey("a", { sortPosition: undefined, updatedAt: "2026-05-01T00:00:00Z" }),
      survey("b", { sortPosition: 0 }),
    ];
    expect(sortSurveys(list, "manual").map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("orders by title A–Z", () => {
    const list = [survey("z", { title: "Zebra" }), survey("a", { title: "Apple" })];
    expect(sortSurveys(list, "title").map((s) => s.id)).toEqual(["a", "z"]);
  });

  it("orders by most-recently-updated for the default sort", () => {
    const list = [
      survey("old", { updatedAt: "2026-01-01T00:00:00Z" }),
      survey("new", { updatedAt: "2026-06-01T00:00:00Z" }),
    ];
    expect(sortSurveys(list, "updated").map((s) => s.id)).toEqual(["new", "old"]);
  });

  it("does not mutate the input", () => {
    const list = [survey("a", { sortPosition: 1 }), survey("b", { sortPosition: 0 })];
    sortSurveys(list, "manual");
    expect(list.map((s) => s.id)).toEqual(["a", "b"]);
  });
});
