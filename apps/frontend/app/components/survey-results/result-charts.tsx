"use client";

// recharts is a large dependency. Load it on demand (client-only) so it is not
// part of the initial bundle — it is only needed once results charts render.
import dynamic from "next/dynamic";

export type { BarDatum, StackedSeries } from "./result-charts-impl";

export const ResultBarChart = dynamic(
  () => import("./result-charts-impl").then((m) => m.ResultBarChart),
  { ssr: false },
);

export const ResultStackedBarChart = dynamic(
  () => import("./result-charts-impl").then((m) => m.ResultStackedBarChart),
  { ssr: false },
);

export const ResultPieChart = dynamic(
  () => import("./result-charts-impl").then((m) => m.ResultPieChart),
  { ssr: false },
);

export const ResultLineChart = dynamic(
  () => import("./result-charts-impl").then((m) => m.ResultLineChart),
  { ssr: false },
);
