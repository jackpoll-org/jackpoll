"use client";

import type { ReactNode } from "react";
import {
  CheckCircle2,
  Eye,
  Globe,
  HelpCircle,
  Megaphone,
  Monitor,
  MousePointerClick,
  Send,
  ShieldCheck,
  Smartphone,
  Tablet,
} from "lucide-react";
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
import { StatTile } from "./stat-tile";
import { clampPercent } from "@/app/lib/survey/format";
import { useTranslation } from "@/app/i18n/context";

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-[width]"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/** Views → Starts → Submits funnel, each bar sized relative to views. */
function Funnel({
  views,
  starts,
  submits,
}: {
  views: number;
  starts: number;
  submits: number;
}) {
  const { t } = useTranslation();
  const rows: { label: string; value: number; icon: ReactNode }[] = [
    { label: t("analytics.views"), value: views, icon: <Eye className="size-4" /> },
    {
      label: t("analytics.starts"),
      value: starts,
      icon: <MousePointerClick className="size-4" />,
    },
    { label: t("analytics.submits"), value: submits, icon: <Send className="size-4" /> },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("analytics.funnel")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {rows.map((r) => {
          const pct = clampPercent(r.value, views);
          return (
            <div key={r.label} className="grid gap-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  {r.icon}
                  {r.label}
                </span>
                <span className="font-medium tabular-nums">
                  {r.value}
                  <span className="ml-1 text-xs text-muted-foreground">{pct}%</span>
                </span>
              </div>
              <ProgressBar percent={pct} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function deviceIcon(key: string): ReactNode {
  switch (key.toLowerCase()) {
    case "mobile":
      return <Smartphone className="size-4" />;
    case "tablet":
      return <Tablet className="size-4" />;
    case "desktop":
      return <Monitor className="size-4" />;
    default:
      return <HelpCircle className="size-4" />;
  }
}

/** Ranked list where each row carries a share bar + count + percent. */
function RankedBarList({
  title,
  entries,
  icon,
  withIcon,
}: {
  title: string;
  entries: CountEntry[];
  icon?: ReactNode;
  /** Per-row leading icon (used for devices). */
  withIcon?: (key: string) => ReactNode;
}) {
  const { t } = useTranslation();
  const total = entries.reduce((sum, e) => sum + e.count, 0);
  const max = entries.reduce((m, e) => Math.max(m, e.count), 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("analytics.noData")}</p>
        ) : (
          <ul className="grid gap-2.5 text-sm">
            {entries.map((e) => (
              <li key={e.key} className="grid gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    {withIcon?.(e.key)}
                    <span className="truncate capitalize">{e.key}</span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {e.count}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {clampPercent(e.count, total)}%
                    </span>
                  </span>
                </div>
                <ProgressBar percent={max > 0 ? clampPercent(e.count, max) : 0} />
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
  // Funnel completion: of those who started, how many submitted (never > 100%).
  // Falls back to submits/views when starts weren't recorded.
  const completion =
    a.starts > 0 ? clampPercent(a.submits, a.starts) : clampPercent(a.submits, a.views);
  const daily = a.daily.map((e) => ({ label: e.key.slice(5), count: e.count }));

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0" />
        {t("analytics.privacy")}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile
          label={t("analytics.views")}
          value={String(a.views)}
          icon={<Eye className="size-5" />}
        />
        <StatTile
          label={t("analytics.starts")}
          value={String(a.starts)}
          hint={t("analytics.ofViews", { pct: String(clampPercent(a.starts, a.views)) })}
          icon={<MousePointerClick className="size-5" />}
        />
        <StatTile
          label={t("analytics.submits")}
          value={String(a.submits)}
          icon={<Send className="size-5" />}
        />
        <StatTile
          label={t("analytics.completion")}
          value={`${completion}%`}
          icon={<CheckCircle2 className="size-5" />}
        />
      </div>

      <Funnel views={a.views} starts={a.starts} submits={a.submits} />

      <div className="grid gap-4 sm:grid-cols-3">
        <RankedBarList
          title={t("analytics.sources")}
          entries={a.sources}
          icon={<Globe className="size-4" />}
        />
        <RankedBarList
          title={t("analytics.channels")}
          entries={a.channels}
          icon={<Megaphone className="size-4" />}
        />
        <RankedBarList
          title={t("analytics.devices")}
          entries={a.devices}
          icon={<Monitor className="size-4" />}
          withIcon={deviceIcon}
        />
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
