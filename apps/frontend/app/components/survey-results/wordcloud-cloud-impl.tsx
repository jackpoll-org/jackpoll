"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/app/i18n/context";
import { CLOUD_COLORS, cloudFontRange, colorWords, type CloudScale, type CloudWord } from "@/app/lib/results/wordcloud";
import { fitCloud, type PlacedWord } from "@/app/lib/results/wordcloud-layout";

// d3-cloud measures each word on a canvas to lay them out without overlap. The
// canvas can't resolve CSS variables (e.g. var(--font-geist-sans)), so the font
// MUST be a concrete family — otherwise every word measures as ~0 wide and they
// stack on top of each other. The same family is used for rendering so the
// measured size matches what's drawn. A stack available on every platform
// (Impact is missing on iOS/Android), matching the PDF export.
const CLOUD_FONT = "Helvetica, Arial, sans-serif";
const CLOUD_FONT_WEIGHT = "bold";

export type { CloudWord };

interface WordcloudCloudProps {
  words: CloudWord[];
  width: number;
  height: number;
  /** Owner-configured palette override (survey settings); falls back to the
   *  theme's chart colors when unset or empty. */
  colors?: string[] | null;
  /** How votes map to size — see {@link CloudScale}. Defaults to "absolute". */
  scale?: CloudScale;
}

interface CloudLayout {
  placed: PlacedWord[];
  dropped: CloudWord[];
}

/**
 * The on-screen word cloud. Font sizes follow the container, and the layout
 * shrinks until every word fits (see fitCloud), so desktop, phone and
 * presentation mode all show the same words (issue #9). Word size grows with
 * frequency — on a gentle absolute scale for free-text words, or relative to
 * the top word for choice options — and each word pops in when it first
 * appears or its count rises.
 * Loaded lazily (client-only) via ../survey-results/wordcloud-result.
 */
export function WordcloudCloud({
  words,
  width,
  height,
  colors,
  scale = "absolute",
}: WordcloudCloudProps) {
  const { t } = useTranslation();
  const palette = colors && colors.length > 0 ? colors : CLOUD_COLORS;
  const [layout, setLayout] = useState<CloudLayout | null>(null);
  // Parents rebuild the words array on every render; relayout only when the
  // words or counts actually change, not on each re-render.
  const wordsKey = words
    .map((w) => `${w.key ?? w.text}\u0000${w.value}\u0000${w.color ?? ""}`)
    .join("\u0001");
  const paletteKey = palette.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by content via wordsKey
  const stableWords = useMemo(() => colorWords(words, palette), [wordsKey, paletteKey]);

  useEffect(() => {
    if (stableWords.length === 0 || width === 0 || height === 0) return;
    let cancelled = false;
    const run = async () => {
      // Measure with the real font, not a fallback that's still loading.
      await document.fonts?.ready;
      const result = await fitCloud(stableWords, {
        width,
        height,
        ...cloudFontRange(width, height),
        scale,
        font: CLOUD_FONT,
        fontWeight: CLOUD_FONT_WEIGHT,
      });
      if (!cancelled) setLayout(result);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [stableWords, width, height, scale]);

  if (words.length === 0 || width === 0 || !layout) return null;

  // overflow-hidden clips any word whose box grazes the edge so it never adds
  // horizontal page scroll (SVG content is not clipped to its viewport by default).
  return (
    <div className="grid gap-2">
      <div className="overflow-hidden">
        <svg width={width} height={height} role="img" aria-label={words.map((w) => w.text).join(", ")}>
          <g transform={`translate(${width / 2}, ${height / 2})`}>
            {layout.placed.map((w) => (
              // Keying by text+size remounts a word only when its count changes
              // (or it's new), so just those words replay the pop animation while
              // unchanged words quietly re-position on relayout.
              <g key={`${w.key ?? w.text}-${w.size}`} transform={`translate(${w.x}, ${w.y})`}>
                <text
                  className="wordcloud-pop"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily={CLOUD_FONT}
                  fontWeight={CLOUD_FONT_WEIGHT}
                  fontSize={w.size}
                  fill={w.color}
                  style={{
                    userSelect: "none",
                    transformBox: "fill-box",
                    transformOrigin: "center",
                  }}
                >
                  {w.text}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>
      {layout.dropped.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {t("wordcloud.notShown", {
            words: layout.dropped.map((w) => `${w.text} (${w.value})`).join(", "),
          })}
        </p>
      )}
    </div>
  );
}
