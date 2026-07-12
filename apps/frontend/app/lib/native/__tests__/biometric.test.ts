import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => "web" },
}));
vi.mock("@aparajita/capacitor-biometric-auth", () => ({
  BiometricAuth: { checkBiometry: vi.fn(), authenticate: vi.fn() },
}));

import {
  biometricEnabled,
  biometricSupported,
  biometricUnlockedRecently,
  clearBiometricUnlock,
  markBiometricUnlocked,
  setBiometricEnabled,
  verifyIdentity,
} from "../biometric";

beforeEach(() => {
  localStorage.clear();
  clearBiometricUnlock();
});

describe("biometric", () => {
  it("is not supported on the web", () => {
    expect(biometricSupported()).toBe(false);
  });

  it("is opt-in (default off) and persists the toggle", () => {
    expect(biometricEnabled()).toBe(false);
    setBiometricEnabled(true);
    expect(biometricEnabled()).toBe(true);
    setBiometricEnabled(false);
    expect(biometricEnabled()).toBe(false);
  });

  it("verifyIdentity fails open on the web (never traps the user)", async () => {
    await expect(verifyIdentity("reason")).resolves.toBe(true);
  });
});

describe("biometric session unlock memory", () => {
  it("is not recently unlocked by default", () => {
    expect(biometricUnlockedRecently()).toBe(false);
  });

  it("counts as recently unlocked right after marking", () => {
    markBiometricUnlocked();
    expect(biometricUnlockedRecently()).toBe(true);
  });

  it("expires after the idle window", () => {
    vi.useFakeTimers();
    try {
      markBiometricUnlocked();
      vi.advanceTimersByTime(60_001);
      expect(biometricUnlockedRecently()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("clear forgets the unlock", () => {
    markBiometricUnlocked();
    clearBiometricUnlock();
    expect(biometricUnlockedRecently()).toBe(false);
  });
});
