import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Survey } from "@/app/types/survey";

const listSurveysApi = vi.fn();
vi.mock("@/app/lib/survey/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/lib/survey/api")>()),
  listSurveysApi: (...args: unknown[]) => listSurveysApi(...args),
}));

import { useSurveys } from "@/app/hooks/survey";

const all = Array.from({ length: 250 }, (_, i) => ({ id: `s${i}`, title: `Quiz ${i}` }) as Survey);

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useSurveys", () => {
  it("loads every page until the total is reached", async () => {
    listSurveysApi.mockImplementation(async (page: number, limit: number) => ({
      success: true,
      data: all.slice(page * limit, page * limit + limit),
      meta: { total: all.length, page, limit },
    }));

    const { result } = renderHook(() => useSurveys(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.surveys).toHaveLength(250);
    expect(result.current.data!.surveys[249].id).toBe("s249");
    expect(listSurveysApi.mock.calls.map(([page, limit]) => [page, limit])).toEqual([
      [0, 100],
      [1, 100],
      [2, 100],
    ]);
  });

  it("fails when a later page fails", async () => {
    listSurveysApi.mockReset();
    listSurveysApi.mockImplementation(async (page: number, limit: number) =>
      page === 0
        ? { success: true, data: all.slice(0, limit), meta: { total: all.length, page, limit } }
        : { success: false, error: "boom" },
    );

    const { result } = renderHook(() => useSurveys(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
