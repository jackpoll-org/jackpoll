import { describe, it, expect, vi } from "vitest";

vi.mock("../built-in", () => ({
  BUILT_IN_PAGES: ["imprint"],
  BUILT_IN_OPERATOR: "Hosted Operator",
}));

import { externalUrl, instanceLegal, legalSource } from "../instance";

describe("externalUrl", () => {
  it("accepts absolute http(s) URLs", () => {
    expect(externalUrl("https://example.org/imprint")).toBe("https://example.org/imprint");
    expect(externalUrl("http://example.org")).toBe("http://example.org/");
  });

  it("rejects other schemes and relative values", () => {
    expect(externalUrl("javascript:alert(1)")).toBeNull();
    expect(externalUrl("data:text/html,x")).toBeNull();
    expect(externalUrl("/imprint")).toBeNull();
  });
});

describe("legalSource", () => {
  it("prefers a configured URL over a file", () => {
    expect(
      legalSource("privacy", { LEGAL_PRIVACY_URL: " https://example.org/privacy ", LEGAL_PRIVACY_FILE: "/x.md" }),
    ).toEqual({ kind: "url", href: "https://example.org/privacy" });
  });

  it("ignores an unsafe URL and falls back to the file", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      legalSource("privacy", { LEGAL_PRIVACY_URL: "javascript:alert(1)", LEGAL_PRIVACY_FILE: "/legal/privacy.md" }),
    ).toEqual({ kind: "file", path: "/legal/privacy.md" });
    expect(error).toHaveBeenCalledWith(expect.stringContaining("LEGAL_PRIVACY_URL"));
    legalSource("privacy", { LEGAL_PRIVACY_URL: "javascript:alert(1)" });
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it("uses the built-in page only when nothing is configured", () => {
    expect(legalSource("imprint", {})).toEqual({ kind: "builtin" });
    expect(legalSource("terms", {})).toBeNull();
  });
});

describe("instanceLegal", () => {
  it("links routes for files and built-ins, external URLs directly", () => {
    expect(
      instanceLegal({ LEGAL_PRIVACY_URL: "https://example.org/privacy", LEGAL_TERMS_FILE: "/legal/terms.md" }),
    ).toEqual({
      links: { imprint: "/impressum", privacy: "https://example.org/privacy", terms: "/terms" },
      operator: "Hosted Operator",
    });
  });

  it("lets LEGAL_ENTITY override the operator name", () => {
    expect(instanceLegal({ LEGAL_ENTITY: "Verein e.V." }).operator).toBe("Verein e.V.");
  });
});
