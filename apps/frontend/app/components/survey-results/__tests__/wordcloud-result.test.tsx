import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="cloud" /> }));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: "en" }),
}));
vi.mock("@/app/lib/results/live-socket", () => ({ liveResultsEnabled: () => true }));

import { WordcloudResult } from "../wordcloud-result";

const words = [{ text: "fun", value: 2, key: "q1:fun" }];

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("WordcloudResult", () => {
  it("keeps the legend visible in present mode", () => {
    render(<WordcloudResult words={words} countLabel="1" legend={<ul data-testid="legend" />} />);
    expect(screen.getByTestId("legend").closest(".fixed")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /results.present/ }));

    expect(screen.getByTestId("legend").closest(".fixed")).toBeTruthy();
  });

  it("lets the caller decide whether the live badge shows", () => {
    const { rerender } = render(<WordcloudResult words={words} countLabel="1" live={false} />);
    expect(screen.queryByText("wordcloud.live")).toBeNull();

    rerender(<WordcloudResult words={words} countLabel="1" live />);
    expect(screen.getByText("wordcloud.live")).toBeTruthy();
  });
});
