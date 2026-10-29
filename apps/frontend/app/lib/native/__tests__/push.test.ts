import { describe, it, expect, vi, beforeEach } from "vitest";

const plugin = vi.hoisted(() => ({
  register: vi.fn(),
  unregister: vi.fn(),
  getStatus: vi.fn(),
  listDistributors: vi.fn(),
  pickDistributor: vi.fn(),
  addListener: vi.fn(),
}));

// Simulate the native Android shell. With UnifiedPush there is no Firebase
// requirement, so push IS supported on Android.
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" },
  registerPlugin: () => plugin,
}));
vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    register: vi.fn(),
    unregister: vi.fn(),
    addListener: vi.fn(),
  },
}));
vi.mock("@/app/lib/survey/api", () => ({
  registerDeviceApi: vi.fn(),
  getWebPushKeyApi: vi.fn(async () => ({ data: { enabled: true, publicKey: "vapid-key" } })),
}));

import { pushSupported, registerPush, resumePushRegistration } from "../push";

describe("push (UnifiedPush)", () => {
  beforeEach(() => {
    plugin.register.mockReset();
  });

  it("is supported on Android via UnifiedPush", () => {
    expect(pushSupported()).toBe(true);
  });

  it("asks for the notification permission when the user turns push on", async () => {
    plugin.register.mockResolvedValue({ outcome: "REGISTERING" });
    await expect(registerPush()).resolves.toBe("REGISTERING");
    expect(plugin.register).toHaveBeenCalledWith({ vapid: "vapid-key", askPermission: true });
  });

  it("reports a denied notification permission", async () => {
    plugin.register.mockResolvedValue({ outcome: "NEEDS_PERMISSION" });
    await expect(registerPush()).resolves.toBe("NEEDS_PERMISSION");
  });

  it("never asks for the permission when resuming a registration", async () => {
    plugin.register.mockResolvedValue({ outcome: "REGISTERING" });
    await resumePushRegistration();
    expect(plugin.register).toHaveBeenCalledWith({ vapid: "vapid-key" });
  });
});
