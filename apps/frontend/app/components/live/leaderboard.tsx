"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { useLiveLeaderboard } from "@/app/hooks/live";
import { prefersReducedMotion } from "@/app/lib/survey/a11y";
import { useTranslation } from "@/app/i18n/context";

/**
 * Live quiz leaderboard (#97): each named player's total score in the running
 * game, from the server's per-session leaderboard. Shown to the presenter and
 * to players on their phones.
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
  const board = useLiveLeaderboard(surveyId, limit).data ?? [];
  const reduced = prefersReducedMotion();

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
            <AnimatePresence initial={false}>
              {board.map((entry, i) => (
                <motion.li
                  layout
                  key={entry.name}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={
                    reduced ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }
                  }
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
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
