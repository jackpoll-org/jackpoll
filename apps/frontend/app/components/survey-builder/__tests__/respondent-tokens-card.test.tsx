import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import type { RespondentToken } from "@/app/types/survey";

const mocks = vi.hoisted(() => ({
  tokens: [] as RespondentToken[],
  add: vi.fn(async () => []),
  remove: vi.fn(async () => undefined),
  download: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, string>) => (vars ? `${k} ${JSON.stringify(vars)}` : k),
  }),
}));
vi.mock("@/app/hooks/respondent-tokens", () => ({
  useRespondentTokens: () => ({ data: mocks.tokens, isLoading: false }),
  useAddRespondentTokens: () => ({ mutateAsync: mocks.add, isPending: false }),
  useDeleteRespondentToken: () => ({ mutateAsync: mocks.remove, isPending: false }),
}));
vi.mock("@/app/hooks/survey", () => ({
  useShareLink: () => ({ data: { slug: "abc" } }),
}));
vi.mock("@/app/lib/survey/export", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/lib/survey/export")>()),
  downloadText: mocks.download,
}));

import { RespondentTokensCard } from "../respondent-tokens-card";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.tokens = [];
});

describe("RespondentTokensCard", () => {
  it("generates the requested number of random tokens", async () => {
    render(<RespondentTokensCard surveyId="s1" isPublished />);
    fireEvent.change(screen.getByLabelText("builder.tokens.count"), { target: { value: "25" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "builder.tokens.generate" }));
    });
    expect(mocks.add).toHaveBeenCalledWith({ count: 25 });
  });

  it("adds a pasted allowlist, one token per line", async () => {
    render(<RespondentTokensCard surveyId="s1" isPublished />);
    fireEvent.change(screen.getByLabelText("builder.tokens.allowlist"), {
      target: { value: "u-1\n\n u-2 \nu-1" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "builder.tokens.add" }));
    });
    expect(mocks.add).toHaveBeenCalledWith({ tokens: ["u-1", "u-2"] });
    expect(screen.getByLabelText("builder.tokens.allowlist")).toHaveValue("");
  });

  it("shows which tokens are used, removes one and downloads links", async () => {
    mocks.tokens = [
      { id: "1", token: "AAA", createdAt: "x", usedAt: "2026-01-01T00:00:00Z" },
      { id: "2", token: "BBB", createdAt: "x" },
    ];
    render(<RespondentTokensCard surveyId="s1" isPublished />);

    expect(screen.getByText('builder.tokens.summary {"used":"1","total":"2"}')).toBeInTheDocument();
    expect(screen.getAllByText("builder.tokens.used")).toHaveLength(1);
    expect(screen.getAllByText("builder.tokens.unused")).toHaveLength(1);

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "builder.tokens.remove" })[1]);
    });
    expect(mocks.remove).toHaveBeenCalledWith("2");

    fireEvent.click(screen.getByRole("button", { name: "builder.tokens.download" }));
    const csv = mocks.download.mock.calls[0][1] as string;
    expect(csv).toContain(`AAA,${window.location.origin}/s/abc?token=AAA,yes`);
  });
});
