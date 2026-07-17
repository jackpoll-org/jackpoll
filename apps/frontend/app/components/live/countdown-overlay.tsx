"use client";

import { useEffect, useState } from "react";
import { COUNTDOWN_GO_MS, COUNTDOWN_NUMERALS, COUNTDOWN_STEP_MS } from "@/app/lib/live/countdown";
import { playReveal, playTick } from "@/app/lib/live/sound";
import { prefersReducedMotion } from "@/app/lib/survey/a11y";
import { useTranslation } from "@/app/i18n/context";

const LAST_STEP = COUNTDOWN_NUMERALS.length; // index of the "Go!" step

/**
 * Synced 3-2-1-Go "get ready" overlay for the live quiz. Shared by the
 * presenter and every participant so the same beat plays on all screens
 * (each device times it locally off when it received the "countdown" phase —
 * there's no server clock to line up against, see app/lib/live/countdown.ts).
 */
export function CountdownOverlay({
  active,
  onComplete,
  questionKey,
}: {
  active: boolean;
  /** Presenter only: fires once the sequence finishes, to start the real timer. */
  onComplete?: () => void;
  /** Remount key so a fast-clicking host restarts the sequence cleanly. */
  questionKey: string | number;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!active) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep(0);

    if (prefersReducedMotion()) {
      onComplete?.();
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= LAST_STEP; i++) {
      timers.push(
        setTimeout(() => {
          setStep(i);
          if (i === LAST_STEP) playReveal();
          else playTick();
        }, COUNTDOWN_STEP_MS * i),
      );
    }
    timers.push(
      setTimeout(() => onComplete?.(), COUNTDOWN_STEP_MS * LAST_STEP + COUNTDOWN_GO_MS),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, questionKey]);

  if (!active) return null;

  const isGo = step === LAST_STEP;
  const label = isGo ? t("live.go") : String(COUNTDOWN_NUMERALS[step]);

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/90 backdrop-blur-sm">
      {!isGo && (
        <p className="text-lg font-medium text-muted-foreground">{t("live.getReady")}</p>
      )}
      <p key={step} className="countdown-pop text-7xl font-black tracking-widest">
        {label}
      </p>
    </div>
  );
}
