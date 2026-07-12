import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => "web" },
}));

const { getWebPushKeyApi, registerDeviceApi } = vi.hoisted(() => ({
  getWebPushKeyApi: vi.fn(),
  registerDeviceApi: vi.fn(),
}));
vi.mock("@/app/lib/survey/api", () => ({ getWebPushKeyApi, registerDeviceApi }));

import { subscribeWebPush, webPushSupported } from "../web-push";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("web-push", () => {
  it("is unsupported without PushManager/serviceWorker", () => {
    // jsdom has no serviceWorker/PushManager by default.
    expect(webPushSupported()).toBe(false);
  });

  it("does nothing and never registers when unsupported", async () => {
    await subscribeWebPush();
    expect(getWebPushKeyApi).not.toHaveBeenCalled();
    expect(registerDeviceApi).not.toHaveBeenCalled();
  });

  it("registers the subscription's endpoint and keys when the instance enables push", async () => {
    // Minimal Web Push environment.
    const subscription = {
      toJSON: () => ({
        endpoint: "https://push.example/abc",
        keys: { p256dh: "P256DH", auth: "AUTH" },
      }),
    };
    const pushManager = {
      getSubscription: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn().mockResolvedValue(subscription),
    };
    vi.stubGlobal("navigator", {
      serviceWorker: { ready: Promise.resolve({ pushManager }) },
    });
    vi.stubGlobal("window", { PushManager: function () {}, Notification: function () {} });
    vi.stubGlobal("Notification", {
      permission: "granted",
      requestPermission: vi.fn(),
    });

    getWebPushKeyApi.mockResolvedValue({
      data: { enabled: true, publicKey: "BPu_l-test-vapid-key" },
    });
    registerDeviceApi.mockResolvedValue({ success: true });

    await subscribeWebPush();

    expect(pushManager.subscribe).toHaveBeenCalledOnce();
    expect(registerDeviceApi).toHaveBeenCalledWith(
      "https://push.example/abc",
      "web",
      { p256dh: "P256DH", auth: "AUTH" },
    );
  });

  it("skips registration when the instance has push disabled", async () => {
    vi.stubGlobal("navigator", { serviceWorker: { ready: Promise.resolve({}) } });
    vi.stubGlobal("window", { PushManager: function () {}, Notification: function () {} });
    vi.stubGlobal("Notification", { permission: "granted", requestPermission: vi.fn() });
    getWebPushKeyApi.mockResolvedValue({ data: { enabled: false, publicKey: "" } });

    await subscribeWebPush();

    expect(registerDeviceApi).not.toHaveBeenCalled();
  });
});
