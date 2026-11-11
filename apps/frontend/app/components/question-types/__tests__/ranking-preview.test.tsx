import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import type { Question } from "@/app/types/survey";

vi.mock("@/app/i18n/context", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

import { RankingPreview } from "../previews/ranking-preview";

const ranking = (settings?: Record<string, unknown>) =>
  ({
    id: "r",
    type: "ranking",
    title: "Sort",
    required: false,
    order: 0,
    options: [
      { id: "1", label: "First" },
      { id: "2", label: "Second" },
      { id: "3", label: "Third" },
    ],
    settings,
  }) as unknown as Question;

afterEach(() => vi.restoreAllMocks());

describe("RankingPreview default answer", () => {
  it("keeps the given order for an opinion ranking", () => {
    const onChange = vi.fn();
    render(<RankingPreview question={ranking()} onChange={onChange} />);
    expect(onChange).toHaveBeenCalledWith(["1", "2", "3"]);
  });

  it("starts a scored order shuffled", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const onChange = vi.fn();
    render(<RankingPreview question={ranking({ scoreOrder: true })} onChange={onChange} />);
    expect(onChange).toHaveBeenCalledWith(["2", "3", "1"]);
  });
});
