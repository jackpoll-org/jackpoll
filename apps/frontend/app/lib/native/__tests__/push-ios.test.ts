import { describe, it, expect, vi, beforeEach } from "vitest";

// Simulate the native iOS shell. A WKWebView has no Push API, so push goes
// through APNs (#51) — no UnifiedPush distributor is involved.
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => "ios" },
  registerPlugin: () => ({
    register: vi.fn(async () => {
      throw new Error("UnifiedPush must not be used on iOS");
    }),
    unregister: vi.fn(async () => {
      throw new Error("UnifiedPush must not be used on iOS");
    }),
    getStatus: vi.fn(async () => {
      throw new Error("UnifiedPush must not be used on iOS");
    }),
    listDistributors: vi.fn(async () => {
      throw new Error("UnifiedPush must not be used on iOS");
    }),
    pickDistributor: vi.fn(),
    addListener: vi.fn(),
  }),
}));

// vi.mock is hoisted above the imports, so the doubles have to be created in a
// hoisted block too — otherwise the factory closes over an uninitialised const.
const { listeners, push, registerDeviceApi } = vi.hoisted(() => {
  const listeners: Record<string, (data: unknown) => void> = {};
  return {
    listeners,
    push: {
      checkPermissions: vi.fn(async () => ({ receive: "granted" })),
      requestPermissions: vi.fn(async () => ({ receive: "granted" })),
      register: vi.fn(async () => {}),
      unregister: vi.fn(async () => {}),
      addListener: vi.fn(async (event: string, cb: (data: unknown) => void) => {
        listeners[event] = cb;
        return { remove: vi.fn() };
      }),
    },
    registerDeviceApi: vi.fn(async () => ({})),
  };
});
vi.mock("@capacitor/push-notifications", () => ({ PushNotifications: push }));
vi.mock("@/app/lib/survey/api", () => ({ registerDeviceApi, getWebPushKeyApi: vi.fn() }));

import {
  pushSupported,
  registerPush,
  resumePushRegistration,
  getPushStatus,
  unregisterPush,
  listPushDistributors,
} from "../push";

describe("push on iOS (APNs)", () => {
  beforeEach(() => {
    registerDeviceApi.mockClear();
    push.register.mockClear();
    push.requestPermissions.mockClear();
  });

  it("is supported", () => {
    expect(pushSupported()).toBe(true);
  });

  it("registers with APNs and reports REGISTERING", async () => {
    expect(await registerPush()).toBe("REGISTERING");
    expect(push.register).toHaveBeenCalled();
  });

  it("sends the APNs token to the backend as platform ios", async () => {
    await registerPush();
    listeners.registration?.({ value: "abc123" });
    expect(registerDeviceApi).toHaveBeenCalledWith("abc123", "ios");
  });

  it("reports registered once a token arrived", async () => {
    await registerPush();
    listeners.registration?.({ value: "abc123" });
    const status = await getPushStatus();
    expect(status).toMatchObject({
      registered: true,
      distributor: "APNs",
      endpoint: "abc123",
    });
  });

  it("offers no distributors to pick", async () => {
    expect(await listPushDistributors()).toEqual([]);
  });

  it("returns NEEDS_PERMISSION when the user denies notifications", async () => {
    push.checkPermissions.mockResolvedValueOnce({ receive: "prompt" });
    push.requestPermissions.mockResolvedValueOnce({ receive: "denied" });
    expect(await registerPush()).toBe("NEEDS_PERMISSION");
    expect(push.register).not.toHaveBeenCalled();
  });

  it("unregisters through the APNs plugin", async () => {
    await unregisterPush();
    expect(push.unregister).toHaveBeenCalled();
  });

  // App start must never spend the one notification prompt iOS grants per
  // install, and must not re-register a device the user never set up.
  it("refreshes the token on start when notifications are already allowed", async () => {
    push.checkPermissions.mockResolvedValueOnce({ receive: "granted" });
    await resumePushRegistration();
    expect(push.register).toHaveBeenCalled();
    expect(push.requestPermissions).not.toHaveBeenCalled();
  });

  it("does nothing on start when the permission was never granted", async () => {
    push.checkPermissions.mockResolvedValueOnce({ receive: "prompt" });
    await resumePushRegistration();
    expect(push.register).not.toHaveBeenCalled();
    expect(push.requestPermissions).not.toHaveBeenCalled();
  });

  it("stays quiet on start when the user denied notifications", async () => {
    push.checkPermissions.mockResolvedValueOnce({ receive: "denied" });
    await resumePushRegistration();
    expect(push.register).not.toHaveBeenCalled();
  });
});
