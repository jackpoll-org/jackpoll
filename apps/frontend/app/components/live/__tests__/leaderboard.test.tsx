import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const getLiveLeaderboardApi = vi.fn();
const listResponsesApi = vi.fn();
vi.mock("@/app/lib/survey/api", async (orig) => ({
  ...(await orig<typeof import("@/app/lib/survey/api")>()),
  getLiveLeaderboardApi: (...a: unknown[]) => getLiveLeaderboardApi(...a),
  listResponsesApi: (...a: unknown[]) => listResponsesApi(...a),
}));
vi.mock("@/app/i18n/context", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock("@/app/lib/survey/a11y", () => ({ prefersReducedMotion: () => true }));

import { Leaderboard } from "../leaderboard";
import { Podium } from "../podium";

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const board = [
  { name: "Ada", score: 200 },
  { name: "Cy", score: 100 },
  { name: "Bob", score: 0 },
];

describe("live leaderboard", () => {
  // The running game's board comes from the server, so players (no account)
  // can see it and earlier games' players never show up.
  it("shows the current game's board from the public endpoint, best first", async () => {
    getLiveLeaderboardApi.mockResolvedValue({ success: true, data: board });
    wrap(<Leaderboard surveyId="s1" limit={5} />);

    await waitFor(() => expect(screen.getByText("Ada")).toBeTruthy());
    const names = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(names[0]).toContain("Ada");
    expect(names[0]).toContain("200");
    expect(names[2]).toContain("Bob");
    expect(getLiveLeaderboardApi).toHaveBeenCalledWith("s1", 5);
    expect(listResponsesApi).not.toHaveBeenCalled();
  });

  it("puts the current game's top three on the podium", async () => {
    getLiveLeaderboardApi.mockResolvedValue({ success: true, data: board });
    wrap(<Podium surveyId="s1" />);

    await waitFor(() => expect(screen.getByText("Ada")).toBeTruthy());
    expect(screen.getByText("Cy")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
    expect(listResponsesApi).not.toHaveBeenCalled();
  });
});
