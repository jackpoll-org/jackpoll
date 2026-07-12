"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useTranslation } from "@/app/i18n/context";
import { liveResultsEnabled } from "@/app/lib/results/live-socket";
import type { QuestionResult } from "@/app/types/survey";
import type { CloudWord } from "./wordcloud-cloud-impl";

// @visx/wordcloud + d3-cloud only run in the browser and add weight — load on
// demand (client-only), matching the recharts lazy pattern in result-charts.tsx.
const WordcloudCloud = dynamic(
  () => import("./wordcloud-cloud-impl").then((m) => m.WordcloudCloud),
  { ssr: false },
);

/** Track an element's width so the (fixed-size) cloud can fill its container. */
function useElementWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0]?.contentRect.width ?? 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

function toWords(optionCounts: Record<string, number> | null | undefined): CloudWord[] {
  return Object.entries(optionCounts ?? {})
    .map(([text, value]) => ({ text, value }))
    .toSorted((a, b) => b.value - a.value);
}

interface WordcloudResultProps {
  result: QuestionResult;
}

/**
 * Owner-facing wordcloud result: renders submitted words sized by frequency,
 * with a fullscreen "present" mode for live audiences. The data refreshes live
 * via the results WebSocket (see hooks/results-live.ts) or polling fallback.
 */
export function WordcloudResult({ result }: WordcloudResultProps) {
  const { t } = useTranslation();
  const { ref, width } = useElementWidth();
  const [presenting, setPresenting] = useState(false);
  // Resolve the live flag after mount so SSR and first client render match
  // (liveResultsEnabled reads window).
  const [live, setLive] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLive(liveResultsEnabled());
  }, []);
  const words = toWords(result.optionCounts);

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

  const height = presenting ? Math.round(width * 0.55) : 320;

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
          {t("wordcloud.wordCount", { count: String(words.length) })}
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

      <div className={presenting ? "min-h-0 flex-1" : ""}>
        {words.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("results.noAnswers")}
          </p>
        ) : (
          <WordcloudCloud
            words={words}
            width={width}
            height={presenting ? Math.max(height, 360) : height}
            maxFontSize={presenting ? 160 : 80}
          />
        )}
      </div>
    </div>
  );
}
