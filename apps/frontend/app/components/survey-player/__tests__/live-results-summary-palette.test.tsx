import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { Survey } from "@/app/types/survey";

vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: "en" }),
}));
vi.mock("@/app/hooks/results-live", () => ({ useLiveResultsSocket: vi.fn() }));
vi.mock("@/app/hooks/survey", () => ({
  useLiveResults: () => ({
    isLoading: false,
    isError: false,
    data: {
      totalResponses: 9,
      questions: ["q1", "q2"].map((id) => ({
        questionId: id,
        title: id,
        type: "wordcloud",
        answered: 1,
        optionCounts: { hi: 1 },
      })),
    },
  }),
}));
vi.mock("@/app/components/survey-results/wordcloud-result", () => ({
  WordcloudResult: ({ colors }: { colors?: string[] | null }) => (
    <div data-testid="cloud">{JSON.stringify(colors ?? null)}</div>
  ),
}));

import { LiveResultsSummary } from "../live-results-summary";

afterEach(cleanup);

describe("LiveResultsSummary palettes", () => {
  it("shows participants the survey palette and each question's own palette", () => {
    const survey = {
      id: "s1",
      settings: { colorPalette: ["#aaaaaa"] },
      questions: [
        { id: "q1", type: "wordcloud", settings: {} },
        { id: "q2", type: "wordcloud", settings: { colorPalette: ["#bbbbbb"] } },
      ],
    } as unknown as Survey;
    render(<LiveResultsSummary survey={survey} />);
    expect(screen.getAllByTestId("cloud").map((c) => c.textContent)).toEqual([
      '["#aaaaaa"]',
      '["#bbbbbb"]',
    ]);
  });
});
