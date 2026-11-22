import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";

vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: "en" }),
}));
vi.mock("@/app/lib/results/wordcloud-layout", () => ({
  fitCloud: vi.fn(async (words: { text: string; key?: string; color?: string }[]) => ({
    placed: words.map((w, i) => ({ text: w.text, key: w.key, color: w.color, size: 20, x: i, y: i })),
    dropped: [],
  })),
}));

import { fitCloud } from "@/app/lib/results/wordcloud-layout";
import { WordcloudCloud } from "../wordcloud-cloud-impl";

afterEach(cleanup);

describe("WordcloudCloud", () => {
  it("draws each word in its own colour and keeps duplicate texts apart", async () => {
    const { container } = render(
      <WordcloudCloud
        width={300}
        height={200}
        words={[
          { text: "fun", value: 2, key: "q1:fun", color: "#112233" },
          { text: "fun", value: 2, key: "q2:fun", color: "#445566" },
        ]}
      />,
    );

    await waitFor(() => expect(container.querySelectorAll("text")).toHaveLength(2));
    const fills = [...container.querySelectorAll("text")].map((el) => el.getAttribute("fill"));
    expect(fills).toEqual(["#112233", "#445566"]);
  });

  it("keeps the palette colours for words without their own colour", async () => {
    const { container } = render(
      <WordcloudCloud width={300} height={200} colors={["#abcdef"]} words={[{ text: "sun", value: 1 }]} />,
    );

    await waitFor(() => expect(container.querySelector("text")).not.toBeNull());
    expect(container.querySelector("text")?.getAttribute("fill")).toBe("#abcdef");
  });

  it("colours words by their order in the word list, even when one is dropped", async () => {
    vi.mocked(fitCloud).mockImplementationOnce(async (words) => ({
      placed: [words[0], words[2]].map((w, i) => ({ text: w.text, key: w.key, color: w.color, size: 20, x: i, y: i })),
      dropped: [words[1]],
    }));
    const { container } = render(
      <WordcloudCloud
        width={300}
        height={200}
        colors={["#aa0000", "#00aa00", "#0000aa"]}
        words={[
          { text: "a", value: 3 },
          { text: "b", value: 2 },
          { text: "c", value: 1 },
        ]}
      />,
    );

    await waitFor(() => expect(container.querySelectorAll("text")).toHaveLength(2));
    expect([...container.querySelectorAll("text")].map((el) => el.getAttribute("fill"))).toEqual(["#aa0000", "#0000aa"]);
  });
});
