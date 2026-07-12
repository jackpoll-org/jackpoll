import { describe, it, expect, vi } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
}));

import { deepLinkPath } from "../deep-links";

describe("deepLinkPath", () => {
  it("keeps the path, query and hash from a universal link", () => {
    expect(deepLinkPath("https://survey.quavon.de/s/abc123?ref=qr")).toBe(
      "/s/abc123?ref=qr",
    );
  });

  it("preserves token query params on email links", () => {
    expect(
      deepLinkPath("https://survey.quavon.de/reset-password?token=xyz"),
    ).toBe("/reset-password?token=xyz");
  });

  it("returns null for the bare origin (nothing to route)", () => {
    expect(deepLinkPath("https://survey.quavon.de/")).toBeNull();
    expect(deepLinkPath("https://survey.quavon.de")).toBeNull();
  });

  it("returns null for an unparseable url", () => {
    expect(deepLinkPath("not a url")).toBeNull();
  });
});
