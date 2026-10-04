import { describe, it, expect } from "vitest";
import { reorderOptions } from "../helpers";
import type { Option } from "@/app/types/survey";

const options: Option[] = [
  { id: "a", label: "A" },
  { id: "b", label: "B", capacity: 3 },
  { id: "c", label: "C" },
];

describe("reorderOptions", () => {
  it("moves an option down onto the target position", () => {
    expect(reorderOptions(options, "a", "c").map((o) => o.id)).toEqual(["b", "c", "a"]);
  });

  it("moves an option up onto the target position", () => {
    expect(reorderOptions(options, "c", "a").map((o) => o.id)).toEqual(["c", "a", "b"]);
  });

  it("keeps option data intact while moving", () => {
    expect(reorderOptions(options, "b", "a")[0]).toEqual({ id: "b", label: "B", capacity: 3 });
  });

  it("does not mutate the input", () => {
    const snapshot = structuredClone(options);
    reorderOptions(options, "a", "c");
    expect(options).toEqual(snapshot);
  });

  it("returns the same list for unknown ids or a no-op move", () => {
    expect(reorderOptions(options, "a", "a")).toBe(options);
    expect(reorderOptions(options, "x", "a")).toBe(options);
    expect(reorderOptions(options, "a", "x")).toBe(options);
  });
});
