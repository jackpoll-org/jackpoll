import { describe, it, expect } from "vitest";
import {
  allowedChartTypes,
  defaultChartType,
  resolveResultChart,
} from "../result-chart";
import type { Question } from "@/app/types/survey";

function q(type: Question["type"], settings?: Record<string, unknown>) {
  return { type, settings } as Pick<Question, "type" | "settings">;
}

describe("allowedChartTypes", () => {
  it("offers bar/pie/donut/wordcloud for single- and multi-select choices", () => {
    for (const type of ["multiple-choice", "dropdown", "checkboxes"] as const) {
      expect(allowedChartTypes(type)).toEqual(["bar", "pie", "donut", "wordcloud"]);
    }
  });

  it("keeps ranking off the word cloud (its counts are weighted points, not votes)", () => {
    expect(allowedChartTypes("ranking")).toEqual(["bar", "pie", "donut"]);
  });

  it("offers bar/line for numeric scales", () => {
    expect(allowedChartTypes("slider")).toEqual(["bar", "line"]);
    expect(allowedChartTypes("rating")).toEqual(["bar", "line"]);
  });

  it("offers nothing for types without a chart picker", () => {
    expect(allowedChartTypes("short-answer")).toEqual([]);
    expect(allowedChartTypes("wordcloud")).toEqual([]);
  });
});

describe("defaultChartType", () => {
  it("keeps today's defaults: pie for single-select, bar otherwise", () => {
    expect(defaultChartType("multiple-choice")).toBe("pie");
    expect(defaultChartType("dropdown")).toBe("pie");
    expect(defaultChartType("checkboxes")).toBe("bar");
    expect(defaultChartType("ranking")).toBe("bar");
    expect(defaultChartType("slider")).toBe("bar");
  });
});

describe("resolveResultChart", () => {
  it("honours a configured chart the type allows", () => {
    expect(resolveResultChart(q("multiple-choice", { resultChart: "bar" }))).toBe("bar");
    expect(resolveResultChart(q("checkboxes", { resultChart: "wordcloud" }))).toBe("wordcloud");
    expect(resolveResultChart(q("rating", { resultChart: "line" }))).toBe("line");
  });

  it("falls back to the type default for missing, unknown or disallowed values", () => {
    expect(resolveResultChart(q("multiple-choice"))).toBe("pie");
    expect(resolveResultChart(q("multiple-choice", { resultChart: "line" }))).toBe("pie");
    expect(resolveResultChart(q("slider", { resultChart: "pie" }))).toBe("bar");
    expect(resolveResultChart(q("ranking", { resultChart: "wordcloud" }))).toBe("bar");
    expect(resolveResultChart(q("dropdown", { resultChart: 42 }))).toBe("pie");
  });

  it("uses the type default when the question is unknown", () => {
    expect(resolveResultChart(undefined, "checkboxes")).toBe("bar");
  });
});
