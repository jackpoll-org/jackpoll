import { describe, it, expect } from "vitest";
import { dateConfig, dateInputType } from "../editors/date-editor";

describe("dateConfig", () => {
  it("defaults to date mode", () => {
    expect(dateConfig(null).mode).toBe("date");
  });
  it("falls back to date for an unknown mode and reads min/max", () => {
    expect(dateConfig({ mode: "bogus" }).mode).toBe("date");
    const cfg = dateConfig({ mode: "datetime", min: "2026-01-01T00:00", max: "2026-12-31T23:59" });
    expect(cfg.mode).toBe("datetime");
    expect(cfg.min).toBe("2026-01-01T00:00");
    expect(cfg.max).toBe("2026-12-31T23:59");
  });
});

describe("dateInputType", () => {
  it("maps modes to native input types", () => {
    expect(dateInputType("date")).toBe("date");
    expect(dateInputType("time")).toBe("time");
    expect(dateInputType("datetime")).toBe("datetime-local");
  });
});
