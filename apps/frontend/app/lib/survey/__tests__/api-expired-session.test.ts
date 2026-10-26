import { afterEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
});
vi.mock("@/app/lib/auth/refresh", () => ({
  refreshAccessToken: vi.fn(async () => {
    store.clear();
    return null;
  }),
}));

import { resolveLinkApi } from "../api";

describe("public survey with a session that can no longer be renewed", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads the survey anonymously instead of failing", async () => {
    store.set("survey-auth-token", "expired.jwt.sig");
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { id: "s1" } }), { status: 200 }));

    await expect(resolveLinkApi("abc")).resolves.toMatchObject({ data: { id: "s1" } });
    const retryHeaders = fetchMock.mock.calls[1][1]?.headers as Record<string, string>;
    expect(retryHeaders.Authorization).toBeUndefined();
  });
});
