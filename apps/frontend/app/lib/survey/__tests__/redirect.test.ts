import { describe, it, expect } from "vitest";
import { normalizeRedirectUrl } from "@/app/lib/survey/redirect";

describe("normalizeRedirectUrl", () => {
  it("accepts full http(s) URLs", () => {
    expect(normalizeRedirectUrl("https://example.com/thanks")).toBe(
      "https://example.com/thanks",
    );
    expect(normalizeRedirectUrl("http://example.com")).toBe(
      "http://example.com/",
    );
  });

  it("defaults a bare host to https", () => {
    expect(normalizeRedirectUrl("example.com")).toBe("https://example.com/");
    expect(normalizeRedirectUrl("  example.com/path  ")).toBe(
      "https://example.com/path",
    );
  });

  it("rejects non-http(s) schemes (XSS/scheme guard)", () => {
    expect(normalizeRedirectUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeRedirectUrl("data:text/html,<script>1</script>")).toBeNull();
    expect(normalizeRedirectUrl("mailto:a@b.com")).toBeNull();
  });

  it("returns null for empty/missing input", () => {
    expect(normalizeRedirectUrl("")).toBeNull();
    expect(normalizeRedirectUrl("   ")).toBeNull();
    expect(normalizeRedirectUrl(null)).toBeNull();
    expect(normalizeRedirectUrl(undefined)).toBeNull();
  });
});
