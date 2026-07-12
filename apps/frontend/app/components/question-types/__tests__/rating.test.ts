import { describe, it, expect } from "vitest";
import { ratingConfig, ratingRange } from "../editors/rating-editor";

describe("ratingConfig", () => {
  it("defaults to stars/5 with no settings", () => {
    const cfg = ratingConfig(null);
    expect(cfg.variant).toBe("stars");
    expect(cfg.max).toBe(5);
  });

  it("falls back to stars for an unknown variant and clamps invalid max", () => {
    expect(ratingConfig({ variant: "bogus" }).variant).toBe("stars");
    expect(ratingConfig({ variant: "stars", max: 1 }).max).toBe(5);
  });

  it("reads end labels", () => {
    const cfg = ratingConfig({ variant: "nps", minLabel: "Low", maxLabel: "High" });
    expect(cfg.variant).toBe("nps");
    expect(cfg.minLabel).toBe("Low");
    expect(cfg.maxLabel).toBe("High");
  });
});

describe("ratingRange", () => {
  it("maps each variant to its numeric range", () => {
    expect(ratingRange("nps", 5)).toEqual({ min: 0, max: 10 });
    expect(ratingRange("emoji", 5)).toEqual({ min: 1, max: 5 });
    expect(ratingRange("likert", 5)).toEqual({ min: 1, max: 5 });
    expect(ratingRange("stars", 7)).toEqual({ min: 1, max: 7 });
  });
});
