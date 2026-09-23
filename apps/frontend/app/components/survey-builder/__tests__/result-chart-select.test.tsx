import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Question } from "@/app/types/survey";

vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: "en" }),
}));

// Radix Select doesn't open in jsdom; a native <select> keeps the same contract
// (value + onValueChange + one option per SelectItem).
vi.mock("@/app/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: ReactNode;
  }) => (
    <select aria-label="qedit.resultChart.label" value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

import { ResultChartSelect } from "../result-chart-select";

afterEach(cleanup);

function question(type: Question["type"], settings?: Record<string, unknown>): Question {
  return { id: "q1", type, title: "Q", required: false, order: 0, settings } as Question;
}

describe("ResultChartSelect", () => {
  it("is hidden for question types without a result chart", () => {
    const { container } = render(
      <ResultChartSelect question={question("short-answer")} onChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows the type default when nothing is configured", () => {
    render(<ResultChartSelect question={question("multiple-choice")} onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveProperty("value", "pie");
  });

  it("offers the word cloud for choice questions but not for ranking", () => {
    const { unmount } = render(
      <ResultChartSelect question={question("checkboxes")} onChange={vi.fn()} />,
    );
    expect(screen.getByRole("option", { name: "results.chart.wordcloud" })).toBeTruthy();
    unmount();

    render(<ResultChartSelect question={question("ranking")} onChange={vi.fn()} />);
    expect(screen.queryByRole("option", { name: "results.chart.wordcloud" })).toBeNull();
  });

  it("saves the pick into the question settings, keeping other settings", () => {
    const onChange = vi.fn();
    render(
      <ResultChartSelect
        question={question("multiple-choice", { shuffleOptions: true })}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "wordcloud" } });

    expect(onChange).toHaveBeenCalledWith({
      settings: { shuffleOptions: true, resultChart: "wordcloud" },
    });
  });

  it("warns about long options only when the word cloud is picked", () => {
    const { unmount } = render(
      <ResultChartSelect question={question("dropdown")} onChange={vi.fn()} />,
    );
    expect(screen.queryByText("qedit.resultChart.wordcloudHint")).toBeNull();
    unmount();

    render(
      <ResultChartSelect
        question={question("dropdown", { resultChart: "wordcloud" })}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("qedit.resultChart.wordcloudHint")).toBeTruthy();
  });
});
