import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the native secure storage + auth storage the restore flow depends on.
const getOfflineToken = vi.fn();
const storeOfflineToken = vi.fn();
const clearOfflineToken = vi.fn();
const storeAuth = vi.fn();

vi.mock("@/app/lib/native/secure-session", () => ({
  getOfflineToken: () => getOfflineToken(),
  storeOfflineToken: (t: string) => storeOfflineToken(t),
  clearOfflineToken: () => clearOfflineToken(),
}));

vi.mock("@/app/lib/auth/storage", () => ({
  storeAuth: (token: string, user: unknown) => storeAuth(token, user),
}));

import { restoreWithOfflineToken } from "@/app/lib/auth/restore";

function mockFetch(status: number, body: unknown) {
  vi.spyOn(global, "fetch").mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

beforeEach(() => {
  vi.restoreAllMocks();
  getOfflineToken.mockReset();
  storeOfflineToken.mockReset();
  clearOfflineToken.mockReset();
  storeAuth.mockReset();
});

describe("restoreWithOfflineToken", () => {
  it("returns false when there is no stored token", async () => {
    getOfflineToken.mockResolvedValue(null);
    expect(await restoreWithOfflineToken()).toBe(false);
  });

  it("stores the fresh access + rotated offline token on success", async () => {
    getOfflineToken.mockResolvedValue("offline-abc");
    mockFetch(200, {
      success: true,
      data: {
        user: { id: "1", email: "a@b.c", name: "A" },
        tokens: { accessToken: "new-access", expiresIn: 300 },
        offlineToken: "offline-rotated",
      },
    });

    const ok = await restoreWithOfflineToken();

    expect(ok).toBe(true);
    expect(storeAuth).toHaveBeenCalledWith("new-access", expect.objectContaining({ id: "1" }));
    expect(storeOfflineToken).toHaveBeenCalledWith("offline-rotated");
    // The header carries the stored offline token (native has no cookie).
    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    expect((init?.headers as Record<string, string>)["X-Refresh-Token"]).toBe("offline-abc");
  });

  it("wipes the offline token on a 401 (revoked/expired)", async () => {
    getOfflineToken.mockResolvedValue("offline-stale");
    mockFetch(401, { success: false });

    const ok = await restoreWithOfflineToken();

    expect(ok).toBe(false);
    expect(clearOfflineToken).toHaveBeenCalled();
    expect(storeAuth).not.toHaveBeenCalled();
  });
});
