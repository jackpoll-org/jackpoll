import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Survey } from "@/app/types/survey";

const createSurveyApi = vi.fn();
const updateSurveyApi = vi.fn();
vi.mock("@/app/lib/survey/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/lib/survey/api")>()),
  createSurveyApi: (...args: unknown[]) => createSurveyApi(...args),
  updateSurveyApi: (...args: unknown[]) => updateSurveyApi(...args),
}));

import { useDuplicateSurvey } from "@/app/hooks/survey";

const source = {
  id: "src",
  title: "LK INF",
  settings: {},
  sections: [
    {
      id: "reflexion",
      title: "Reflexion",
      order: 0,
      visibleIf: { match: "all", conditions: [{ questionId: "q1", operator: "notEmpty" }] },
    },
  ],
  questions: [
    { id: "q1", type: "short-answer", title: "Name", required: false, order: 0, sectionId: null },
    { id: "q2", type: "short-answer", title: "Fazit", required: false, order: 1, sectionId: "reflexion" },
  ],
} as unknown as Survey;

describe("useDuplicateSurvey", () => {
  it("copies the sections its questions belong to", async () => {
    createSurveyApi.mockResolvedValue({ success: true, data: { id: "copy", title: "Copy of LK INF" } });
    updateSurveyApi.mockImplementation(async (_id: string, req: unknown) => ({ success: true, data: req }));
    const client = new QueryClient();
    const { result } = renderHook(() => useDuplicateSurvey(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });

    await act(() => result.current.mutateAsync(source));

    const [, request] = updateSurveyApi.mock.calls[0];
    expect(request.sections.map((x: { title: string }) => x.title)).toEqual(["Reflexion"]);
    expect(request.sections[0].visibleIf.conditions[0].questionId).toBe(request.questions[0].id);
    expect(request.questions.map((q: { sectionId: string | null }) => q.sectionId)).toEqual([null, "reflexion"]);
  });
});
