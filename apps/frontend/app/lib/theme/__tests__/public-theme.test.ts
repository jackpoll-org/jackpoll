import { describe, expect, it } from "vitest";
import { forcesLightTheme, isPublicPath, readableForeground } from "../public-theme";

describe("readableForeground", () => {
  it("uses white text on dark accents", () => {
    expect(readableForeground("#000000")).toBe("#ffffff");
    expect(readableForeground("#1e3a8a")).toBe("#ffffff");
    expect(readableForeground("#c00")).toBe("#ffffff");
    expect(readableForeground("#767676")).toBe("#ffffff");
  });

  it("uses near-black text on light accents", () => {
    expect(readableForeground("#ffffff")).toBe("#0a0a0a");
    expect(readableForeground("#FACC15")).toBe("#0a0a0a");
    expect(readableForeground(" #a7f3d0 ")).toBe("#0a0a0a");
  });

  it("leaves non-hex colours to the theme", () => {
    expect(readableForeground("red")).toBeUndefined();
    expect(readableForeground("#12345")).toBeUndefined();
  });
});

describe("forcesLightTheme", () => {
  it("forces light only when a custom background is set", () => {
    expect(forcesLightTheme({ backgroundColor: "#fef3c7" })).toBe(true);
    expect(forcesLightTheme({ backgroundColor: "" })).toBe(false);
    expect(forcesLightTheme({})).toBe(false);
  });
});

describe("isPublicPath", () => {
  it.each(["/s/abc", "/join", "/join/x", "/results/1", "/embed/1", "/e/tok", "/r/tok"])(
    "treats %s as public",
    (path) => expect(isPublicPath(path)).toBe(true),
  );

  it.each(["/", "/surveys", "/settings", "/joiner", "/collab/x", "/login", null])(
    "treats %s as dashboard",
    (path) => expect(isPublicPath(path)).toBe(false),
  );
});
