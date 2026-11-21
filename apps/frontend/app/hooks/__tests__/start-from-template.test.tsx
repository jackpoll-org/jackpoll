import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SurveyTemplate } from "@/app/lib/survey/templates";

const createSurveyApi = vi.fn();
const updateSurveyApi = vi.fn();
const deleteSurveyApi = vi.fn();
const push = vi.fn();
vi.mock("@/app/lib/survey/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/lib/survey/api")>()),
  createSurveyApi: (...args: unknown[]) => createSurveyApi(...args),
  updateSurveyApi: (...args: unknown[]) => updateSurveyApi(...args),
  deleteSurveyApi: (...args: unknown[]) => deleteSurveyApi(...args),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/app/i18n/context", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

import { useStartFromTemplate } from "@/app/hooks/templates";

const template = {
  id: "t1",
  name: "Weekly",
  description: "",
  category: "custom",
  source: "custom",
  questions: [],
  sections: [],
} as unknown as SurveyTemplate;

function renderTwo() {
  const client = new QueryClient();
  return renderHook(() => [useStartFromTemplate(), useStartFromTemplate()] as const, {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  createSurveyApi.mockResolvedValue({ success: true, data: { id: "s1", title: "Weekly", settings: {} } });
  updateSurveyApi.mockResolvedValue({ success: true, data: {} });
  deleteSurveyApi.mockResolvedValue({ success: true, data: null });
});

describe("useStartFromTemplate", () => {
  it("runs one start at a time across every caller", async () => {
    const { result } = renderTwo();
    let started: boolean[] = [];
    await act(async () => {
      started = await Promise.all([result.current[0].start(template), result.current[1].start(template)]);
    });
    expect(started).toEqual([true, false]);
    expect(createSurveyApi).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/surveys/s1/edit");
  });

  it("deletes the blank survey when applying the template throws", async () => {
    updateSurveyApi.mockRejectedValue(new Error("network down"));
    const { result } = renderTwo();
    await act(async () => {
      await expect(result.current[0].start(template)).rejects.toThrow("network down");
    });
    expect(deleteSurveyApi).toHaveBeenCalledWith("s1");
    expect(push).not.toHaveBeenCalled();
    updateSurveyApi.mockResolvedValue({ success: true, data: {} });
  });

  it("deletes the blank survey when the template cannot be applied", async () => {
    updateSurveyApi.mockResolvedValue({ success: false, error: "boom" });
    const { result } = renderTwo();
    await act(async () => {
      await expect(result.current[0].start(template)).rejects.toThrow("boom");
    });
    expect(deleteSurveyApi).toHaveBeenCalledWith("s1");
    expect(push).not.toHaveBeenCalled();
    updateSurveyApi.mockResolvedValue({ success: true, data: {} });
    await act(async () => {
      expect(await result.current[1].start(template)).toBe(true);
    });
  });
});
