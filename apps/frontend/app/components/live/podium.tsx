"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useResponses } from "@/app/hooks/survey";
import { prefersReducedMotion } from "@/app/lib/survey/a11y";
import { useTranslation } from "@/app/i18n/context";

/** Aggregated top players for the final podium. */
function useScoreboard(surveyId: string) {
  const responses = useResponses(surveyId);
  return useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of responses.data ?? []) {
      const name = r.respondentName?.trim();
      if (!name) continue;
      totals.set(name, (totals.get(name) ?? 0) + (r.score ?? 0));
    }
    return [...totals.entries()]
      .map(([name, score]) => ({ name, score }))
      .toSorted((a, b) => b.score - a.score);
  }, [responses.data]);
}

// Podium column order (2nd, 1st, 3rd) with per-place styling.
const PLACES = [
  { i: 1, h: "h-24", bar: "bg-zinc-300 dark:bg-zinc-500", medal: "🥈" },
  { i: 0, h: "h-32", bar: "bg-amber-400", medal: "🥇" },
  { i: 2, h: "h-20", bar: "bg-amber-700/70", medal: "🥉" },
];

export function Podium({ surveyId }: { surveyId: string }) {
  const { t } = useTranslation();
  const board = useScoreboard(surveyId);
  const rest = board.slice(3);
  const reduced = prefersReducedMotion();
  // Reveal in dramatic order: 3rd, then 2nd, then 1st.
  const placeDelay = (i: number) => (i === 2 ? 0 : i === 1 ? 0.25 : 0.5);

  if (board.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("live.noScores")}
      </p>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-end justify-center gap-3">
        {PLACES.map(({ i, h, bar, medal }) => {
          const entry = board[i];
          if (!entry) return null;
          const delay = placeDelay(i);
          return (
            <motion.div
              key={i}
              initial={reduced ? false : { opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 200, damping: 18, delay }
              }
              className="flex w-24 flex-col items-center gap-2"
            >
              {i === 0 && <Crown className="size-6 text-amber-400" />}
              <span className="max-w-full truncate text-center font-semibold">
                {entry.name}
              </span>
              <span className="tabular-nums text-sm text-muted-foreground">
                {entry.score}
              </span>
              <motion.div
                initial={reduced ? false : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={
                  reduced ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 18, delay }
                }
                style={{ transformOrigin: "bottom" }}
                className={cn(
                  "flex w-full items-start justify-center rounded-t-md pt-2 text-2xl",
                  h,
                  bar,
                )}
              >
                {medal}
              </motion.div>
            </motion.div>
          );
        })}
      </div>

      {rest.length > 0 && (
        <ol className="mx-auto grid w-full max-w-md gap-2" start={4}>
          <AnimatePresence initial={false}>
            {rest.map((entry, i) => (
              <motion.li
                layout
                key={entry.name}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 400, damping: 30, delay: 0.75 + i * 0.05 }
                }
                className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-6 text-center text-sm font-bold tabular-nums text-muted-foreground">
                    {i + 4}
                  </span>
                  <span className="truncate font-medium">{entry.name}</span>
                </span>
                <span className="tabular-nums text-sm">{entry.score}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </div>
  );
}
