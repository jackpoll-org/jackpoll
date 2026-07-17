import { describe, it, expect } from "vitest";
import { dateConfig } from "../editors/date-editor";

describe("dateConfig", () => {
  it("defaults to date mode with empty bounds", () => {
    const cfg = dateConfig(null);
    expect(cfg.mode).toBe("date");
    expect(cfg.dateMin).toBe("");
    expect(cfg.dateMax).toBe("");
    expect(cfg.timeMin).toBe("");
    expect(cfg.timeMax).toBe("");
  });

  it("falls back to date for an unknown mode", () => {
    expect(dateConfig({ mode: "bogus" }).mode).toBe("date");
  });

  it("reads independent date/time min-max pairs", () => {
    const cfg = dateConfig({
      mode: "datetime",
      dateMin: "2026-01-01",
      dateMax: "2026-12-31",
      timeMin: "09:00",
      timeMax: "17:00",
    });
    expect(cfg.mode).toBe("datetime");
    expect(cfg.dateMin).toBe("2026-01-01");
    expect(cfg.dateMax).toBe("2026-12-31");
    expect(cfg.timeMin).toBe("09:00");
    expect(cfg.timeMax).toBe("17:00");
  });

  it("splits a legacy combined min/max in date mode into dateMin/dateMax", () => {
    const cfg = dateConfig({ mode: "date", min: "2026-01-01", max: "2026-12-31" });
    expect(cfg.dateMin).toBe("2026-01-01");
    expect(cfg.dateMax).toBe("2026-12-31");
    expect(cfg.timeMin).toBe("");
    expect(cfg.timeMax).toBe("");
  });

  it("splits a legacy combined min/max in time mode into timeMin/timeMax", () => {
    const cfg = dateConfig({ mode: "time", min: "09:00", max: "17:00" });
    expect(cfg.timeMin).toBe("09:00");
    expect(cfg.timeMax).toBe("17:00");
    expect(cfg.dateMin).toBe("");
    expect(cfg.dateMax).toBe("");
  });

  it("splits a legacy combined datetime min/max into both pairs", () => {
    const cfg = dateConfig({
      mode: "datetime",
      min: "2026-01-01T09:00",
      max: "2026-12-31T17:00",
    });
    expect(cfg.dateMin).toBe("2026-01-01");
    expect(cfg.timeMin).toBe("09:00");
    expect(cfg.dateMax).toBe("2026-12-31");
    expect(cfg.timeMax).toBe("17:00");
  });

  it("prefers the new split fields over legacy min/max when both are present", () => {
    const cfg = dateConfig({
      mode: "date",
      min: "2020-01-01",
      max: "2020-12-31",
      dateMin: "2026-01-01",
      dateMax: "2026-12-31",
    });
    expect(cfg.dateMin).toBe("2026-01-01");
    expect(cfg.dateMax).toBe("2026-12-31");
  });
});
