import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { Question, QuestionResult } from "@/app/types/survey";

vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: "en" }),
}));
vi.mock("../wordcloud-result", () => ({
  WordcloudResult: ({ colors }: { colors?: string[] | null }) => (
    <div data-testid="cloud">{JSON.stringify(colors ?? null)}</div>
  ),
}));

import { QuestionResultCard } from "../question-result-card";

afterEach(cleanup);

const result = {
  questionId: "q1",
  title: "Words",
  type: "wordcloud",
  answered: 2,
  optionCounts: { hello: 2 },
} as unknown as QuestionResult;

const question = (settings: Question["settings"]) =>
  ({ id: "q1", type: "wordcloud", title: "Words", settings }) as unknown as Question;

describe("QuestionResultCard palette", () => {
  it("draws with the question palette over the survey palette", () => {
    render(
      <QuestionResultCard
        result={result}
        question={question({ colorPalette: ["#123456"] })}
        colors={["#abcdef"]}
      />,
    );
    expect(screen.getByTestId("cloud").textContent).toBe('["#123456"]');
  });

  it("falls back to the survey palette", () => {
    render(<QuestionResultCard result={result} question={question({})} colors={["#abcdef"]} />);
    expect(screen.getByTestId("cloud").textContent).toBe('["#abcdef"]');
  });

  it("renders a header action", () => {
    render(<QuestionResultCard result={result} action={<button>palette</button>} />);
    expect(screen.getByRole("button", { name: "palette" })).toBeTruthy();
  });
});
