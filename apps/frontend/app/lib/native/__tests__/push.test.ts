import { describe, it, expect, vi } from "vitest";

// Simulate the native Android shell, where push must stay disabled until a
// Firebase google-services.json exists (otherwise register() crashes the app).
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" },
}));
vi.mock("@capacitor/push-notifications", () => ({ PushNotifications: {} }));
vi.mock("@/app/lib/survey/api", () => ({ registerDeviceApi: vi.fn() }));

import { pushSupported } from "../push";

describe("push", () => {
  it("is disabled on Android (no Firebase config → would crash)", () => {
    expect(pushSupported()).toBe(false);
  });
});
