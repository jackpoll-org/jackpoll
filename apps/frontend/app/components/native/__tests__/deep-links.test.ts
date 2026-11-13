import { describe, it, expect, vi } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
}));

import { deepLinkPath } from "../deep-links";

const origin = window.location.origin;

describe("deepLinkPath", () => {
  it("keeps the path, query and hash from a universal link", () => {
    expect(deepLinkPath(`${origin}/s/abc123?ref=qr`)).toBe(
      "/s/abc123?ref=qr",
    );
  });

  it("preserves token query params on email links", () => {
    expect(
      deepLinkPath(`${origin}/reset-password?token=xyz`),
    ).toBe("/reset-password?token=xyz");
  });

  it("returns null for the bare origin (nothing to route)", () => {
    expect(deepLinkPath(`${origin}/`)).toBeNull();
    expect(deepLinkPath(`${origin}`)).toBeNull();
  });

  it("returns null for a protocol-relative path that would leave the app", () => {
    expect(deepLinkPath(`${origin}//evil.com`)).toBeNull();
  });

  it("returns null for a link to another instance so its secrets stay off this one", () => {
    expect(deepLinkPath("https://app.jackpoll.org/collab/x")).toBeNull();
    expect(deepLinkPath("https://app.jackpoll.org/e/token?k=v")).toBeNull();
  });

  it("returns null for an unparseable url", () => {
    expect(deepLinkPath("not a url")).toBeNull();
  });
});
