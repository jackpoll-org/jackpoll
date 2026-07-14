import { describe, it, expect, vi } from "vitest";

// Simulate the native Android shell. With UnifiedPush there is no Firebase
// requirement, so push IS supported on Android.
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" },
  registerPlugin: () => ({
    register: vi.fn(),
    unregister: vi.fn(),
    getStatus: vi.fn(),
    listDistributors: vi.fn(),
    pickDistributor: vi.fn(),
    addListener: vi.fn(),
  }),
}));
vi.mock("@/app/lib/survey/api", () => ({ registerDeviceApi: vi.fn() }));

import { pushSupported } from "../push";

describe("push (UnifiedPush)", () => {
  it("is supported on Android via UnifiedPush", () => {
    expect(pushSupported()).toBe(true);
  });
});
