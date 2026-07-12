"use client";

import { useMemo } from "react";
import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { useResponses } from "@/app/hooks/survey";
import { useTranslation } from "@/app/i18n/context";

/**
 * Live quiz leaderboard (#97). Sums each named participant's quiz score across
 * the answers they've submitted so far. Updates live via the results socket
 * (the presenter already keeps responses fresh).
 */
export function Leaderboard({
  surveyId,
  limit = 10,
}: {
  surveyId: string;
  /** How many top players to show (e.g. 5 for the interim standings). */
  limit?: number;
}) {
  const { t } = useTranslation();
  const responses = useResponses(surveyId);

  const board = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of responses.data ?? []) {
      const name = r.respondentName?.trim();
      if (!name) continue;
      totals.set(name, (totals.get(name) ?? 0) + (r.score ?? 0));
    }
    return [...totals.entries()]
      .map(([name, score]) => ({ name, score }))
      .toSorted((a, b) => b.score - a.score)
      .slice(0, limit);
  }, [responses.data, limit]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="size-4 text-amber-500" />
          {t("live.leaderboard")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {board.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t("live.noScores")}
          </p>
        ) : (
          <ol className="grid gap-2">
            {board.map((entry, i) => (
              <li
                key={entry.name}
                className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-6 text-center text-sm font-bold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="truncate font-medium">{entry.name}</span>
                </span>
                <Badge variant="secondary" className="tabular-nums">
                  {entry.score}
                </Badge>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
