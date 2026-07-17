"use client";

import { useEffect, useState } from "react";
import { animate, useMotionValue } from "framer-motion";
import { prefersReducedMotion } from "@/app/lib/survey/a11y";

/**
 * Tweens a displayed integer up from 0 to `value` on mount, and from its
 * previous value whenever `value` changes on an already-mounted instance
 * (headless version of CountUp, for interpolating into an existing
 * translated string rather than rendering its own element).
 */
export function useAnimatedNumber(value: number, duration = 0.8): number {
  const motionValue = useMotionValue(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      motionValue.set(value);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplay(value);
      return;
    }
    const controls = animate(motionValue, value, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return display;
}

/** Renders a tweening number, e.g. a score count-up on reveal. */
export function CountUp({
  value,
  duration = 0.8,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const display = useAnimatedNumber(value, duration);
  return <span className={className}>{display}</span>;
}
