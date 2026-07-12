import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => "web" },
}));

const store: Record<string, string> = {};
vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: store[key] ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => {
      store[key] = value;
    },
    remove: async ({ key }: { key: string }) => {
      delete store[key];
    },
  },
}));

import {
  DEFAULT_INSTANCE_URL,
  getInstanceUrl,
  instancePickerSupported,
  isRememberablePath,
  normalizeInstanceUrl,
} from "../instance";

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
});

describe("instance helpers", () => {
  it("is not supported on the web", () => {
    expect(instancePickerSupported()).toBe(false);
  });

  it("normalizes URLs (adds https, strips trailing slashes)", () => {
    expect(normalizeInstanceUrl("survey.example.com")).toBe("https://survey.example.com");
    expect(normalizeInstanceUrl("https://x.com/")).toBe("https://x.com");
    expect(normalizeInstanceUrl("  http://x.com//  ")).toBe("http://x.com");
    expect(normalizeInstanceUrl("")).toBe("");
  });

  it("returns the default when no instance is stored", async () => {
    expect(await getInstanceUrl()).toBe(DEFAULT_INSTANCE_URL);
    store["instance_url"] = "https://my.host";
    expect(await getInstanceUrl()).toBe("https://my.host");
  });

  it("only remembers real in-app paths (not auth screens)", () => {
    expect(isRememberablePath("/surveys/abc/edit")).toBe(true);
    expect(isRememberablePath("/surveys?folder=f1")).toBe(true);
    expect(isRememberablePath("/login")).toBe(false);
    expect(isRememberablePath("/login?redirect=/surveys")).toBe(false);
    expect(isRememberablePath("/register")).toBe(false);
    expect(isRememberablePath("https://evil.com")).toBe(false);
  });
});
