"use client";

import { Label } from "@/app/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { useTranslation } from "@/app/i18n/context";
import {
  allowedChartTypes,
  CHART_LABEL_KEY,
  RESULT_CHART_SETTING,
  resolveResultChart,
  type ChartType,
} from "@/app/lib/survey/result-chart";
import type { Question } from "@/app/types/survey";

interface ResultChartSelectProps {
  question: Question;
  onChange: (patch: Partial<Question>) => void;
}

/**
 * Builder control for the chart a question's results open with (public #1),
 * the word cloud included for choice questions (public #2). Hidden for types
 * that have no chart choice.
 */
export function ResultChartSelect({ question, onChange }: ResultChartSelectProps) {
  const { t } = useTranslation();
  const allowed = allowedChartTypes(question.type);
  if (allowed.length < 2) return null;

  const id = `result-chart-${question.id}`;
  const value = resolveResultChart(question);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor={id} className="text-sm font-normal">
        {t("qedit.resultChart.label")}
      </Label>
      <Select
        value={value}
        onValueChange={(v) =>
          onChange({
            settings: { ...question.settings, [RESULT_CHART_SETTING]: v as ChartType },
          })
        }
      >
        <SelectTrigger id={id} className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allowed.map((ct) => (
            <SelectItem key={ct} value={ct}>
              {t(CHART_LABEL_KEY[ct])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value === "wordcloud" && (
        <p className="basis-full text-xs text-muted-foreground">
          {t("qedit.resultChart.wordcloudHint")}
        </p>
      )}
    </div>
  );
}
