import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createSurveyApi,
  deleteSurveyApi,
  getSurveyApi,
  listSurveysApi,
  updateSurveyApi,
} from "@/app/lib/survey/api";
import type { Survey } from "@/app/types/survey";

// ── fetch mock ────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(global, "fetch").mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

const sampleSurvey: Survey = {
  id: "s1",
  ownerId: "owner-1",
  title: "Feedback",
  status: "draft",
  settings: {
    allowMultipleResponses: false,
    showProgressBar: false,
    shuffleQuestions: false,
    isQuiz: false,
      showLiveResults: false,
      postSubmitSummary: false,
      showPoweredBy: false,
    rateLimit: false,
    onePerBrowser: false,
    requireCaptcha: false,
  },
  questions: [],
  createdAt: "2026-06-10T00:00:00Z",
  updatedAt: "2026-06-10T00:00:00Z",
};

describe("listSurveysApi", () => {
  it("requests the list with pagination params and returns data + meta", async () => {
    const spy = mockFetch(200, {
      success: true,
      data: [sampleSurvey],
      meta: { total: 1, page: 0, limit: 20 },
    });

    const result = await listSurveysApi(0, 20);

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.meta?.total).toBe(1);
    expect(spy.mock.calls[0][0]).toContain("/surveys?page=0&limit=20");
  });
});

describe("getSurveyApi", () => {
  it("returns a single survey", async () => {
    mockFetch(200, { success: true, data: sampleSurvey });

    const result = await getSurveyApi("s1");
    expect(result.data?.id).toBe("s1");
  });

  it("throws on 404", async () => {
    mockFetch(404, { success: false, error: "Survey not found: s1" });
    await expect(getSurveyApi("s1")).rejects.toThrow("not found");
  });
});

describe("createSurveyApi", () => {
  it("POSTs and attaches the auth token", async () => {
    localStorage.setItem("survey-auth-token", "jwt-123");
    const spy = mockFetch(201, { success: true, data: sampleSurvey });

    const result = await createSurveyApi({ title: "Feedback" });

    expect(result.data?.id).toBe("s1");
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer jwt-123",
    );
  });
});

describe("updateSurveyApi", () => {
  it("PUTs the full survey payload", async () => {
    const spy = mockFetch(200, { success: true, data: sampleSurvey });

    await updateSurveyApi("s1", {
      title: "Updated",
      status: "published",
      questions: [],
    });

    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("PUT");
    expect(spy.mock.calls[0][0]).toContain("/surveys/s1");
  });
});

describe("deleteSurveyApi", () => {
  it("DELETEs and returns success", async () => {
    const spy = mockFetch(200, { success: true, data: null });

    const result = await deleteSurveyApi("s1");

    expect(result.success).toBe(true);
    expect((spy.mock.calls[0][1] as RequestInit).method).toBe("DELETE");
  });
});
