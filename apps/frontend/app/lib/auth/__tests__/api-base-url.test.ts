// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

describe("API_BASE_URL on the server", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("reaches the backend's /api/v1 like the browser proxy does", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://backend:8080");
    const { API_BASE_URL } = await import("../constants");
    expect(API_BASE_URL).toBe("http://backend:8080/api/v1");
  });
});
