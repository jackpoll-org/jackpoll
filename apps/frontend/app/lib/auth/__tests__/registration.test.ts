import { describe, it, expect, vi, afterEach } from "vitest";
import { registrationEnabled } from "@/app/lib/auth/registration";

afterEach(() => vi.unstubAllGlobals());

const respond = (body: unknown, ok = true) => vi.fn().mockResolvedValue({ ok, json: async () => body });

describe("registrationEnabled", () => {
  it("follows the backend", async () => {
    vi.stubGlobal("fetch", respond({ data: { registrationEnabled: false } }));
    expect(await registrationEnabled()).toBe(false);
    vi.stubGlobal("fetch", respond({ data: { registrationEnabled: true } }));
    expect(await registrationEnabled()).toBe(true);
  });

  it("stays open when the backend is unreachable or older", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await registrationEnabled()).toBe(true);
    vi.stubGlobal("fetch", respond({ data: {} }));
    expect(await registrationEnabled()).toBe(true);
    vi.stubGlobal("fetch", respond({ data: { registrationEnabled: false } }, false));
    expect(await registrationEnabled()).toBe(true);
  });
});
