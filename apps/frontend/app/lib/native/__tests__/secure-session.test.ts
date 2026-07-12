import { describe, it, expect, vi } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => "web" },
}));
const { set } = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock("@aparajita/capacitor-secure-storage", () => ({
  SecureStorage: { get: vi.fn(), set, remove: vi.fn() },
  KeychainAccess: { whenUnlockedThisDeviceOnly: 1 },
}));

import {
  getOfflineToken,
  hasOfflineToken,
  secureSessionSupported,
  storeOfflineToken,
} from "../secure-session";

describe("secure-session", () => {
  it("is not supported on the web", () => {
    expect(secureSessionSupported()).toBe(false);
  });

  it("reads return null and never touch the keychain on the web", async () => {
    expect(await getOfflineToken()).toBeNull();
    expect(await hasOfflineToken()).toBe(false);
    await storeOfflineToken("tok");
    expect(set).not.toHaveBeenCalled();
  });
});
