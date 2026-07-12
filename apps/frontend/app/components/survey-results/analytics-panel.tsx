"use client";

import { ShieldCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Skeleton } from "@/app/components/ui/skeleton";
import { useSurveyAnalytics } from "@/app/hooks/survey";
import type { CountEntry } from "@/app/types/survey";
import { ResultBarChart } from "./result-charts";
import { useTranslation } from "@/app/i18n/context";

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-normal text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function CountTable({ title, entries }: { title: string; entries: CountEntry[] }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("analytics.noData")}</p>
        ) : (
          <ul className="grid gap-1 text-sm">
            {entries.map((e) => (
              <li key={e.key} className="flex justify-between gap-2">
                <span className="truncate capitalize">{e.key}</span>
                <span className="font-medium tabular-nums">{e.count}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function AnalyticsPanel({ surveyId }: { surveyId: string }) {
  const { t } = useTranslation();
  const analytics = useSurveyAnalytics(surveyId);

  if (analytics.isLoading) {
    return <Skeleton className="h-64 rounded-xl" />;
  }
  if (analytics.isError || !analytics.data) {
    return (
      <p className="text-sm text-destructive">
        {analytics.error instanceof Error
          ? analytics.error.message
          : t("analytics.loadFailed")}
      </p>
    );
  }

  const a = analytics.data;
  const completion = a.views > 0 ? Math.round((a.submits / a.views) * 100) : 0;
  const daily = a.daily.map((e) => ({ label: e.key.slice(5), count: e.count }));

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0" />
        {t("analytics.privacy")}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi label={t("analytics.views")} value={String(a.views)} />
        <Kpi label={t("analytics.starts")} value={String(a.starts)} />
        <Kpi label={t("analytics.submits")} value={String(a.submits)} />
        <Kpi label={t("analytics.completion")} value={`${completion}%`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <CountTable title={t("analytics.sources")} entries={a.sources} />
        <CountTable title={t("analytics.channels")} entries={a.channels} />
        <CountTable title={t("analytics.devices")} entries={a.devices} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("analytics.viewsPerDay")}</CardTitle>
        </CardHeader>
        <CardContent>
          {daily.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("analytics.noViews")}</p>
          ) : (
            <ResultBarChart data={daily} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
