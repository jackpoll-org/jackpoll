"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { uploadFileUrl } from "@/app/lib/survey/api";
import { labelMap } from "@/app/lib/survey/export";
import { groupTextAnswers } from "@/app/lib/survey/results";
import { remainingFor } from "@/app/lib/survey/quota";
import type { Question, QuestionResult } from "@/app/types/survey";
import { useTranslation } from "@/app/i18n/context";
import type { TranslationKey } from "@/app/i18n/translations";
import {
  ResultBarChart,
  ResultLineChart,
  ResultPieChart,
  ResultStackedBarChart,
  type BarDatum,
} from "./result-charts";
import { WordcloudResult } from "./wordcloud-result";

type ChartType = "bar" | "pie" | "donut" | "line";
const CHART_LABEL_KEY: Record<ChartType, TranslationKey> = {
  bar: "results.chart.bar",
  pie: "results.chart.pie",
  donut: "results.chart.donut",
  line: "results.chart.line",
};

/** A chart with a per-question type picker (issue #87). */
function SelectableChart({
  data,
  allowed,
  defaultType,
}: {
  data: BarDatum[];
  allowed: ChartType[];
  defaultType: ChartType;
}) {
  const { t } = useTranslation();
  const [type, setType] = useState<ChartType>(defaultType);
  return (
    <div className="grid gap-2">
      <div className="flex justify-end">
        <Select value={type} onValueChange={(v) => setType(v as ChartType)}>
          <SelectTrigger className="h-7 w-24 text-xs" aria-label={t("results.chartType")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allowed.map((ct) => (
              <SelectItem key={ct} value={ct} className="text-xs">
                {t(CHART_LABEL_KEY[ct])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {type === "bar" && <ResultBarChart data={data} />}
      {type === "pie" && <ResultPieChart data={data} />}
      {type === "donut" && <ResultPieChart data={data} donut />}
      {type === "line" && <ResultLineChart data={data} />}
    </div>
  );
}

interface QuestionResultCardProps {
  result: QuestionResult;
  question?: Question;
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <p className="py-6 text-center text-sm text-muted-foreground">
      {t("results.noAnswers")}
    </p>
  );
}

/** Remaining capacity per capped option (issue #38). */
function QuotaSummary({ question }: { question?: Question }) {
  const { t } = useTranslation();
  const capped = (question?.options ?? []).filter((o) => o.capacity != null);
  if (capped.length === 0) return null;
  return (
    <div className="grid gap-1 border-t pt-3">
      <p className="text-xs font-medium text-muted-foreground">{t("results.remainingCapacity")}</p>
      {capped.map((o) => {
        const remaining = remainingFor(o) ?? 0;
        return (
          <div key={o.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{o.label}</span>
            <Badge variant={remaining === 0 ? "destructive" : "secondary"}>
              {remaining === 0
                ? t("results.choice.full")
                : t("results.choice.remaining", {
                    remaining: String(remaining),
                    capacity: String(o.capacity),
                  })}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

export function QuestionResultCard({ result, question }: QuestionResultCardProps) {
  const { t } = useTranslation();
  const labels = labelMap(question);
  const label = (id: string) => labels[id] ?? id;

  function body() {
    if (result.answered === 0) return <EmptyState />;

    switch (result.type) {
      case "multiple-choice":
      case "dropdown":
      case "checkboxes":
      case "ranking": {
        const data: BarDatum[] = Object.entries(result.optionCounts ?? {}).map(
          ([id, count]) => ({ label: label(id), count }),
        );
        // Single-select reads well as a pie; multi-select/ranking as bars.
        const single = result.type === "multiple-choice" || result.type === "dropdown";
        return (
          <div className="grid gap-3">
            <SelectableChart
              data={data}
              allowed={["bar", "pie", "donut"]}
              defaultType={single ? "pie" : "bar"}
            />
            <QuotaSummary question={question} />
          </div>
        );
      }

      case "slider":
      case "rating": {
        // optionCounts is a value → count histogram; keys are the numbers.
        const data: BarDatum[] = Object.entries(result.optionCounts ?? {}).map(
          ([value, count]) => ({ label: value, count }),
        );
        const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
        return (
          <div className="grid gap-3">
            <SelectableChart data={data} allowed={["bar", "line"]} defaultType="bar" />
            {result.average != null && (
              <div className="flex gap-4 text-sm">
                <span>
                  <span className="text-muted-foreground">{t("results.average")}:</span>{" "}
                  <span className="font-medium tabular-nums">{fmt(result.average)}</span>
                </span>
                {result.median != null && (
                  <span>
                    <span className="text-muted-foreground">{t("results.median")}:</span>{" "}
                    <span className="font-medium tabular-nums">{fmt(result.median)}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        );
      }

      case "multiple-choice-grid":
      case "checkbox-grid": {
        const rows = result.rows ?? [];
        const colIds = Array.from(
          new Set(rows.flatMap((r) => Object.keys(r.columnCounts))),
        );
        const series = colIds.map((id) => ({ key: id, label: label(id) }));
        const data = rows.map((r) => ({ row: label(r.rowId), ...r.columnCounts }));
        return <ResultStackedBarChart data={data} series={series} />;
      }

      case "rating-grid": {
        // Columns are the numeric scale values, not option ids — label them as-is.
        const rows = result.rows ?? [];
        const colIds = Array.from(
          new Set(rows.flatMap((r) => Object.keys(r.columnCounts))),
        ).toSorted((a, b) => Number(a) - Number(b));
        const series = colIds.map((id) => ({ key: id, label: id }));
        const data = rows.map((r) => ({ row: label(r.rowId), ...r.columnCounts }));
        return <ResultStackedBarChart data={data} series={series} />;
      }

      case "wordcloud":
        // optionCounts is a word → frequency map; render it as a live cloud
        // with a fullscreen presentation mode.
        return <WordcloudResult result={result} />;

      case "short-answer": {
        // Group identical answers, treating case/whitespace as the same (#).
        const grouped = groupTextAnswers(result.textAnswers ?? []);
        return (
          <ul className="grid gap-2">
            {grouped.map(({ label: text, count }) => (
              <li
                key={text.toLowerCase()}
                className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm"
              >
                <span className="min-w-0 break-words">{text}</span>
                {count > 1 && (
                  <Badge variant="secondary" className="shrink-0 tabular-nums">
                    ×{count}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        );
      }

      case "date": {
        const answers = result.textAnswers ?? [];
        return (
          <ul className="grid gap-2">
            {answers.map((text, i) => (
              <li
                key={`${i}:${text}`}
                className="rounded-md border bg-muted/40 px-3 py-2 text-sm"
              >
                {text}
              </li>
            ))}
          </ul>
        );
      }

      case "file-upload":
      case "signature": {
        const files = result.files ?? [];
        return (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {files.map((file, i) => (
              <a
                key={`${file.key}-${i}`}
                href={uploadFileUrl(file.key)}
                target="_blank"
                rel="noopener noreferrer"
                className="relative aspect-square overflow-hidden rounded-md border"
              >
                <Image
                  src={uploadFileUrl(file.key)}
                  alt={file.filename}
                  fill
                  unoptimized
                  sizes="120px"
                  className="object-cover"
                />
              </a>
            ))}
          </div>
        );
      }

      default:
        return <EmptyState />;
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-medium">
            {result.title || t("results.untitledQuestion")}
          </CardTitle>
          <Badge variant="secondary" className="shrink-0">
            {t("results.answered", { count: String(result.answered) })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>{body()}</CardContent>
    </Card>
  );
}
