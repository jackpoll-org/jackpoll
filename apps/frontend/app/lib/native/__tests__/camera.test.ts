import { describe, it, expect, vi } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => "web" },
}));
const { getPhoto } = vi.hoisted(() => ({ getPhoto: vi.fn() }));
vi.mock("@capacitor/camera", () => ({
  Camera: { getPhoto },
  CameraResultType: { Uri: "uri" },
  CameraSource: { Camera: "CAMERA" },
}));

import { capturePhoto, isNativePlatform } from "../camera";

describe("camera", () => {
  it("reports the platform", () => {
    expect(isNativePlatform()).toBe(false);
  });

  it("returns null when the capture has no path (cancelled)", async () => {
    getPhoto.mockResolvedValueOnce({ webPath: undefined });
    expect(await capturePhoto()).toBeNull();
  });
});
