"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useTranslation } from "@/app/i18n/context";
import { liveResultsEnabled } from "@/app/lib/results/live-socket";
import type { CloudScale, CloudWord } from "@/app/lib/results/wordcloud";

// d3-cloud only runs in the browser and add weight — load on
// demand (client-only), matching the recharts lazy pattern in result-charts.tsx.
const WordcloudCloud = dynamic(
  () => import("./wordcloud-cloud-impl").then((m) => m.WordcloudCloud),
  { ssr: false },
);

/** Track an element's size so the (fixed-size) cloud can fill its container. */
function useElementSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      setSize({ width: rect?.width ?? 0, height: rect?.height ?? 0 });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, ...size };
}

const CARD_HEIGHT = 320;
const MIN_PRESENT_HEIGHT = 240;

interface WordcloudResultProps {
  /** Words sized by value — see lib/results/wordcloud for building them. */
  words: CloudWord[];
  /** Header text, e.g. "12 unique words" or "4 options". */
  countLabel: string;
  /** Owner-configured palette override (survey settings). */
  colors?: string[] | null;
  /** "absolute" for free-text words, "relative" for choice options. */
  scale?: CloudScale;
}

/**
 * Owner-facing word cloud: renders words sized by frequency, with a fullscreen
 * "present" mode for live audiences. Used for the wordcloud question type and
 * as a chart option for choice questions. The data refreshes live via the
 * results WebSocket (see hooks/results-live.ts) or polling fallback.
 */
export function WordcloudResult({ words, countLabel, colors, scale }: WordcloudResultProps) {
  const { t } = useTranslation();
  const { ref, width } = useElementSize();
  // In presentation mode the cloud fills whatever the viewport leaves below the
  // header — measured, not derived from the width, so a portrait phone gets its
  // full height instead of a squashed strip (issue #9).
  const { ref: stageRef, height: stageHeight } = useElementSize();
  const [presenting, setPresenting] = useState(false);
  // Resolve the live flag after mount so SSR and first client render match
  // (liveResultsEnabled reads window).
  const [live, setLive] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLive(liveResultsEnabled());
  }, []);

  const enter = useCallback(() => {
    setPresenting(true);
    const el = ref.current;
    if (el?.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        // Fullscreen API can reject (WebView/permission) — the fixed-overlay
        // fallback styling already covers the viewport, so ignore.
      });
    }
  }, [ref]);

  const exit = useCallback(() => {
    setPresenting(false);
    if (typeof document !== "undefined" && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Keep our state in sync when the user leaves native fullscreen via Esc.
  useEffect(() => {
    const onChange = () => {
      if (typeof document !== "undefined" && !document.fullscreenElement) {
        setPresenting(false);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Esc exits the fixed-overlay fallback when native fullscreen is unavailable.
  useEffect(() => {
    if (!presenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presenting, exit]);

  const height = presenting ? Math.max(Math.floor(stageHeight), MIN_PRESENT_HEIGHT) : CARD_HEIGHT;

  return (
    <div
      ref={ref}
      className={
        presenting
          ? "fixed inset-0 z-50 flex flex-col gap-3 bg-background p-6"
          : "relative grid gap-2"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm text-muted-foreground tabular-nums">
          {countLabel}
          {live && (
            <span className="flex items-center gap-1 text-xs font-medium text-green-600">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-green-500" />
              </span>
              {t("wordcloud.live")}
            </span>
          )}
        </span>
        <Button
          type="button"
          variant={presenting ? "secondary" : "outline"}
          size="sm"
          onClick={presenting ? exit : enter}
        >
          {presenting ? (
            <>
              <Minimize2 className="size-4" /> {t("results.exitPresent")}
            </>
          ) : (
            <>
              <Maximize2 className="size-4" /> {t("results.present")}
            </>
          )}
        </Button>
      </div>

      <div ref={stageRef} className={presenting ? "min-h-0 flex-1" : ""}>
        {words.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("results.noAnswers")}
          </p>
        ) : (
          <WordcloudCloud
            words={words}
            width={width}
            height={height}
            colors={colors}
            scale={scale}
          />
        )}
      </div>
    </div>
  );
}
