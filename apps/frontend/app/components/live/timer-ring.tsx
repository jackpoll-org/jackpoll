"use client";

import { prefersReducedMotion } from "@/app/lib/survey/a11y";
import { cn } from "@/lib/utils";

const RADIUS = 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Live quiz time-remaining ring: replaces the plain "{n}s" badge with a
 * smoothly-draining progress ring (driven by useCountdownFraction) plus the
 * numeral (from useCountdown) centered on top.
 */
export function TimerRing({
  remaining,
  fraction,
}: {
  remaining: number | null;
  fraction: number | null;
}) {
  if (remaining == null) return null;
  const low = remaining <= 5;
  const offset = CIRCUMFERENCE * (1 - (fraction ?? 0));

  return (
    <span className={cn("relative inline-flex size-10 shrink-0 items-center justify-center")}>
      <svg viewBox="0 0 40 40" className="size-10 -rotate-90">
        <circle
          cx="20"
          cy="20"
          r={RADIUS}
          fill="none"
          strokeWidth="3"
          className="stroke-muted"
        />
        <circle
          cx="20"
          cy="20"
          r={RADIUS}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className={low ? "stroke-destructive" : "stroke-foreground"}
          style={{ transition: prefersReducedMotion() ? "none" : "stroke-dashoffset 100ms linear" }}
        />
      </svg>
      <span
        className={cn(
          "absolute text-xs font-bold tabular-nums",
          low ? "text-destructive" : "text-foreground",
        )}
      >
        {remaining}
      </span>
    </span>
  );
}
