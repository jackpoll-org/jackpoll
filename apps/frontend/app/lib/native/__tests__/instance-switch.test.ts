import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { platform, switchTo } = vi.hoisted(() => ({
  platform: { current: "android" },
  switchTo: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => platform.current },
  registerPlugin: () => ({ switchTo }),
}));

const store: Record<string, string> = vi.hoisted(() => ({}));
vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: store[key] ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => {
      store[key] = value;
    },
  },
}));

import { switchToInstance } from "../instance";

const URL_B = "https://survey.example.com";
let replace: ReturnType<typeof vi.fn>;

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  switchTo.mockReset();
  platform.current = "android";
  replace = vi.fn();
  vi.stubGlobal("location", { ...window.location, replace });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("switchToInstance", () => {
  it("uses the native bridge on Android and does not navigate", async () => {
    switchTo.mockResolvedValue(undefined);
    await switchToInstance(URL_B);
    expect(switchTo).toHaveBeenCalledWith({ url: URL_B });
    expect(replace).not.toHaveBeenCalled();
  });

  it("falls back to navigation on Android builds without the bridge", async () => {
    switchTo.mockRejectedValue({ code: "UNIMPLEMENTED" });
    await switchToInstance(URL_B);
    expect(store.instance_url).toBe(URL_B);
    expect(replace).toHaveBeenCalledWith(URL_B);
  });

  it("rethrows other bridge errors without navigating", async () => {
    switchTo.mockRejectedValue(new Error("Could not store the instance URL"));
    await expect(switchToInstance(URL_B)).rejects.toThrow("Could not store");
    expect(replace).not.toHaveBeenCalled();
  });

  it("stores and navigates on iOS", async () => {
    platform.current = "ios";
    await switchToInstance(URL_B);
    expect(switchTo).not.toHaveBeenCalled();
    expect(store.instance_url).toBe(URL_B);
    expect(replace).toHaveBeenCalledWith(URL_B);
  });
});
