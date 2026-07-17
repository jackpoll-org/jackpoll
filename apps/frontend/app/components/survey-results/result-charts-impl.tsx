"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
  "var(--chart-9)",
  "var(--chart-10)",
];

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--popover-foreground)",
  fontSize: 12,
};

const tickStyle = { fill: "var(--muted-foreground)", fontSize: 12 } as const;

export interface BarDatum {
  label: string;
  count: number;
}

/** Horizontal bar chart for single-dimension option counts. */
export function ResultBarChart({ data }: { data: BarDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 42)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis type="number" allowDecimals={false} tick={tickStyle} />
        <YAxis type="category" dataKey="label" width={130} tick={tickStyle} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--accent)" }} />
        <Bar dataKey="count" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Pie (or donut) chart for single-dimension option counts. */
export function ResultPieChart({
  data,
  donut = false,
  colors,
}: {
  data: BarDatum[];
  donut?: boolean;
  /** Owner-configured palette override (survey settings); falls back to the
   *  theme's chart colors when unset or empty. */
  colors?: string[] | null;
}) {
  const palette = colors && colors.length > 0 ? colors : CHART_COLORS;
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 28)}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="label"
          innerRadius={donut ? "55%" : 0}
          outerRadius="80%"
          paddingAngle={donut ? 2 : 0}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Line chart for an ordered value → count distribution (slider/rating). */
export function ResultLineChart({ data }: { data: BarDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ left: 8, right: 24, top: 8 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={tickStyle} />
        <YAxis allowDecimals={false} tick={tickStyle} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "var(--accent)" }} />
        <Line
          type="monotone"
          dataKey="count"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export interface StackedSeries {
  key: string;
  label: string;
}

/** Stacked bar chart for grid questions: one row per category, columns stacked. */
export function ResultStackedBarChart({
  data,
  series,
  colors,
}: {
  data: Array<Record<string, string | number>>;
  series: StackedSeries[];
  /** Owner-configured palette override (survey settings); falls back to the
   *  theme's chart colors when unset or empty. */
  colors?: string[] | null;
}) {
  const palette = colors && colors.length > 0 ? colors : CHART_COLORS;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 48)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis type="number" allowDecimals={false} tick={tickStyle} />
        <YAxis type="category" dataKey="row" width={130} tick={tickStyle} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--accent)" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId="grid"
            fill={palette[i % palette.length]}
            radius={2}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
