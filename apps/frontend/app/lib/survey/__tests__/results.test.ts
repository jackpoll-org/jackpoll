import { describe, it, expect } from "vitest";
import { groupDateAnswers, groupTextAnswers } from "../results";

describe("groupTextAnswers", () => {
  it("groups answers case-insensitively and counts them", () => {
    const out = groupTextAnswers(["Yes", "yes", "YES", "No"]);
    expect(out).toEqual([
      { label: "Yes", count: 3 },
      { label: "No", count: 1 },
    ]);
  });

  it("trims surrounding whitespace when grouping", () => {
    const out = groupTextAnswers([" apple ", "Apple", "apple"]);
    expect(out).toEqual([{ label: "apple", count: 3 }]);
  });

  it("keeps the first occurrence's casing as the label", () => {
    const out = groupTextAnswers(["Banana", "banana"]);
    expect(out[0].label).toBe("Banana");
  });

  it("drops blank answers", () => {
    expect(groupTextAnswers(["", "   ", "x"])).toEqual([{ label: "x", count: 1 }]);
  });

  it("sorts by count desc, then alphabetically", () => {
    const out = groupTextAnswers(["b", "b", "a", "c", "c"]);
    expect(out.map((g) => g.label)).toEqual(["b", "c", "a"]);
  });

  it("returns an empty array for no answers", () => {
    expect(groupTextAnswers([])).toEqual([]);
  });
});

describe("groupDateAnswers", () => {
  it("lists offered dates nobody picked with a zero count", () => {
    const out = groupDateAnswers(["2026-11-13", "2026-11-13"], "date", [
      "2026-11-20",
      "2026-11-06",
      "2026-11-13",
      "",
    ]);
    expect(out.map((g) => [g.date, g.count])).toEqual([
      ["2026-11-06", 0],
      ["2026-11-13", 2],
      ["2026-11-20", 0],
    ]);
  });
});
