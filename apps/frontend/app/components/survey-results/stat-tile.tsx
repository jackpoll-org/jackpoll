import type { ReactNode } from "react";
import { Card, CardContent } from "@/app/components/ui/card";

interface StatTileProps {
  label: string;
  value: string;
  icon?: ReactNode;
  /** Optional sub-value shown under the main figure. */
  hint?: string;
  /** Optional native tooltip on the value (e.g. an absolute timestamp). */
  valueTitle?: string;
}

/**
 * Shared KPI tile for the results dashboard — a labelled figure with an
 * optional accent icon. Replaces the ad-hoc KpiCard/Kpi duplicates.
 */
export function StatTile({ label, value, icon, hint, valueTitle }: StatTileProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-normal text-muted-foreground">{label}</p>
          <p
            className="mt-1 truncate text-2xl font-bold tabular-nums"
            title={valueTitle}
          >
            {value}
          </p>
          {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
        {icon && (
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            {icon}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
