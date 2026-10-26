import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { storeAuth } from "../storage";

describe("storeAuth", () => {
  let cookie = "";

  beforeEach(() => {
    vi.stubGlobal("localStorage", { setItem: vi.fn() });
    vi.spyOn(document, "cookie", "set").mockImplementation((value) => {
      cookie = value;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps the route guard cookie as long as the server session", () => {
    storeAuth("jwt", {}, 2592000);
    expect(cookie).toContain("survey-auth-token=jwt; max-age=2592000;");
  });

  it("falls back to a browser-session cookie when the lifetime is unknown", () => {
    storeAuth("jwt", {});
    expect(cookie).not.toContain("max-age");
  });
});
