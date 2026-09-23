import { describe, it, expect, vi } from "vitest";

interface FakeWord {
  text: string;
  size: number;
}

// d3-cloud needs a real canvas to measure words, which jsdom lacks. The fake
// records the layout settings and "places" every word except any whose text
// is marked as too long, like d3-cloud silently dropping words that don't fit.
const calls: { size?: [number, number]; font?: string; fontWeight?: string } = {};
vi.mock("d3-cloud", () => ({
  default: () => {
    let words: FakeWord[] = [];
    let fontSize: (w: FakeWord) => number = () => 0;
    let onEnd: (placed: unknown[]) => void = () => {};
    const api = {
      size: (s: [number, number]) => ((calls.size = s), api),
      words: (w: FakeWord[]) => ((words = w), api),
      padding: () => api,
      rotate: () => api,
      font: (f: string) => ((calls.font = f), api),
      fontWeight: (f: string) => ((calls.fontWeight = f), api),
      fontSize: (f: (w: FakeWord) => number) => ((fontSize = f), api),
      random: () => api,
      spiral: () => api,
      canvas: () => api,
      on: (_: string, cb: (placed: unknown[]) => void) => ((onEnd = cb), api),
      start: () => {
        onEnd(
          words
            .filter((w) => !w.text.startsWith("TOO-LONG"))
            .map((w, i) => ({ text: w.text, size: fontSize(w), x: i * 10, y: -i * 5 })),
        );
        return api;
      },
    };
    return api;
  },
}));

import { layoutCloud } from "../wordcloud-layout";

describe("layoutCloud", () => {
  const opts = { width: 400, height: 200, minFontSize: 10, maxFontSize: 40, scale: "relative" as const };

  it("places words at sizes from the shared scale", async () => {
    const { placed } = await layoutCloud(
      [
        { text: "Simple", value: 4 },
        { text: "Fast", value: 1 },
      ],
      opts,
    );

    expect(calls.size).toEqual([400, 200]);
    expect(placed).toEqual([
      { text: "Simple", size: 40, x: 0, y: -0 },
      { text: "Fast", size: 25, x: 10, y: -5 },
    ]);
  });

  it("reports words the layout could not fit", async () => {
    const { placed, dropped } = await layoutCloud(
      [
        { text: "Simple", value: 4 },
        { text: "TOO-LONG an entire sentence as an option", value: 2 },
      ],
      opts,
    );

    expect(placed.map((w) => w.text)).toEqual(["Simple"]);
    expect(dropped).toEqual([{ text: "TOO-LONG an entire sentence as an option", value: 2 }]);
  });

  it("returns nothing to place for no words", async () => {
    expect(await layoutCloud([], opts)).toEqual({ placed: [], dropped: [] });
  });
});
