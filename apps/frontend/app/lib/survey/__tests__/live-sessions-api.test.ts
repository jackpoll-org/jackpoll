import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getResultsApi,
  listLiveSessionsApi,
  listResponsesApi,
  startLiveSessionApi,
} from "@/app/lib/survey/api";

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

function mockFetch(body: unknown) {
  return vi.spyOn(global, "fetch").mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => body,
  } as Response);
}

describe("live quiz session API", () => {
  it("starts a session with a bodyless POST", async () => {
    const spy = mockFetch({ success: true, data: { id: "sess-1", startedAt: "t", responses: 0, players: 0 } });
    const res = await startLiveSessionApi("s1");
    expect(res.data?.id).toBe("sess-1");
    expect(spy.mock.calls[0][0]).toContain("/surveys/s1/live/sessions");
    expect((spy.mock.calls[0][1] as RequestInit).method).toBe("POST");
  });

  it("lists a survey's sessions", async () => {
    const spy = mockFetch({ success: true, data: [] });
    await listLiveSessionsApi("s1");
    expect(spy.mock.calls[0][0]).toContain("/surveys/s1/live/sessions");
  });

  it("narrows results to a session, alongside the preview flag", async () => {
    const spy = mockFetch({ success: true, data: {} });
    await getResultsApi("s1", true, "sess-1");
    const url = String(spy.mock.calls[0][0]);
    expect(url).toContain("/surveys/s1/results?");
    expect(url).toContain("preview=true");
    expect(url).toContain("session=sess-1");
  });

  it("asks for all results when no session is picked", async () => {
    const spy = mockFetch({ success: true, data: {} });
    await getResultsApi("s1");
    expect(String(spy.mock.calls[0][0])).not.toContain("session=");
  });

  it("narrows the response list to a session", async () => {
    const spy = mockFetch({ success: true, data: [] });
    await listResponsesApi("s1", "sess-1");
    expect(String(spy.mock.calls[0][0])).toContain("/surveys/s1/responses?session=sess-1");
  });
});
