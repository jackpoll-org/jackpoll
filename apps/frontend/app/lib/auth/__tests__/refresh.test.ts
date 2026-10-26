import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock("../storage", () => ({ clearAuth: vi.fn(), storeAuth: vi.fn() }));

import { refreshAccessToken } from "../refresh";

describe("refreshAccessToken when the session cannot be renewed", () => {
  const assign = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    vi.stubGlobal("location", { ...window.location, assign, pathname: "", search: "" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    assign.mockReset();
  });

  it("keeps a visitor on a shared survey link instead of sending them to login", async () => {
    window.location.pathname = "/s/abc123";
    await expect(refreshAccessToken()).resolves.toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });

  it("sends a signed-in page to login with the way back", async () => {
    window.location.pathname = "/surveys";
    window.location.search = "?tab=mine";
    await refreshAccessToken();
    expect(assign).toHaveBeenCalledWith("/login?expired=1&redirect=%2Fsurveys%3Ftab%3Dmine");
  });
});
