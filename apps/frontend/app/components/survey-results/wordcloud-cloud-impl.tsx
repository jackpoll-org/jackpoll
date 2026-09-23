"use client";

import { Wordcloud } from "@visx/wordcloud";
import { cloudFontSize, type CloudScale, type CloudWord } from "@/app/lib/results/wordcloud";

const CLOUD_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
  "var(--chart-9)",
  "var(--chart-10)",
];

// d3-cloud measures each word on a canvas to lay them out without overlap. The
// canvas can't resolve CSS variables (e.g. var(--font-geist-sans)), so the font
// MUST be a concrete family — otherwise every word measures as ~0 wide and they
// stack on top of each other. The same family is used for rendering so the
// measured size matches what's drawn.
const CLOUD_FONT = "Impact, 'Arial Narrow', sans-serif";

export type { CloudWord };

interface WordcloudCloudProps {
  words: CloudWord[];
  width: number;
  height: number;
  /** Largest font size (px) used for the most frequent word. */
  maxFontSize?: number;
  /** Smallest font size (px) used for a single-vote word. */
  minFontSize?: number;
  /** Owner-configured palette override (survey settings); falls back to the
   *  theme's chart colors when unset or empty. */
  colors?: string[] | null;
  /** How votes map to size — see {@link CloudScale}. Defaults to "absolute". */
  scale?: CloudScale;
}

/**
 * The actual @visx/wordcloud render. Word size grows with frequency — on a
 * gentle absolute scale for free-text words (normalizing would blow up a 2-vote
 * word), or relative to the top word for choice options — and each word pops in
 * when it first appears or its count rises.
 * Loaded lazily (client-only) via ../survey-results/wordcloud-result.
 */
export function WordcloudCloud({
  words,
  width,
  height,
  maxFontSize = 80,
  minFontSize = 22,
  colors,
  scale = "absolute",
}: WordcloudCloudProps) {
  const palette = colors && colors.length > 0 ? colors : CLOUD_COLORS;
  const maxValue = Math.max(0, ...words.map((w) => w.value));
  const fontSize = (w: CloudWord) =>
    cloudFontSize(w.value, maxValue, { minFontSize, maxFontSize, scale });

  if (words.length === 0 || width === 0) return null;

  // overflow-hidden clips any word whose box grazes the edge so it never adds
  // horizontal page scroll (SVG content is not clipped to its viewport by default).
  return (
    <div className="overflow-hidden">
      <Wordcloud
        words={words}
        width={width}
        height={height}
        fontSize={fontSize}
        font={CLOUD_FONT}
        padding={2}
        spiral="archimedean"
        rotate={0}
        random={() => 0.5}
      >
        {(cloudWords) =>
          cloudWords.map((w, i) => (
            // Keying by text+size remounts a word only when its count changes
            // (or it's new), so just those words replay the pop animation while
            // unchanged words quietly re-position on relayout.
            <g
              key={`${w.text}-${w.size}`}
              transform={`translate(${w.x}, ${w.y}) rotate(${w.rotate ?? 0})`}
            >
              <text
                className="wordcloud-pop"
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily={CLOUD_FONT}
                fontSize={w.size}
                fill={palette[i % palette.length]}
                style={{
                  userSelect: "none",
                  transformBox: "fill-box",
                  transformOrigin: "center",
                }}
              >
                {w.text}
              </text>
            </g>
          ))
        }
      </Wordcloud>
    </div>
  );
}
