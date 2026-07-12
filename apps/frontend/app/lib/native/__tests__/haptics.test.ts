import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => "web" },
}));
const { impact, notification } = vi.hoisted(() => ({
  impact: vi.fn().mockResolvedValue(undefined),
  notification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@capacitor/haptics", () => ({
  Haptics: { impact, notification },
  ImpactStyle: { Light: "LIGHT", Medium: "MEDIUM", Heavy: "HEAVY" },
  NotificationType: { Success: "SUCCESS", Warning: "WARNING", Error: "ERROR" },
}));

import {
  hapticsEnabled,
  hapticsSupported,
  hImpact,
  hNotify,
  hSelection,
  NotificationType,
  setHapticsEnabled,
} from "../haptics";

beforeEach(() => {
  localStorage.clear();
  impact.mockClear();
  notification.mockClear();
});

describe("haptics", () => {
  it("is not supported on the web", () => {
    expect(hapticsSupported()).toBe(false);
  });

  it("defaults on and persists the opt-out", () => {
    expect(hapticsEnabled()).toBe(true);
    setHapticsEnabled(false);
    expect(hapticsEnabled()).toBe(false);
  });

  it("no-ops on the web (never calls the plugin)", async () => {
    await hImpact();
    await hNotify(NotificationType.Success);
    await hSelection();
    expect(impact).not.toHaveBeenCalled();
    expect(notification).not.toHaveBeenCalled();
  });
});
