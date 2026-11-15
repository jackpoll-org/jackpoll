import { describe, it, expect } from "vitest";
import { safeButtonUrl } from "@/app/lib/survey/completion-buttons";

describe("safeButtonUrl", () => {
  it("accepts absolute http(s) URLs", () => {
    expect(safeButtonUrl("https://example.com/quizzes")).toBe("https://example.com/quizzes");
    expect(safeButtonUrl(" HTTP://example.com ")).toBe("http://example.com/");
    expect(safeButtonUrl("https://[::1]:8080/x?y#z")).toBe("https://[::1]:8080/x?y#z");
  });

  it("defaults a bare host to https", () => {
    expect(safeButtonUrl("example.com/quizzes")).toBe("https://example.com/quizzes");
  });

  it.each([
    undefined,
    "",
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,hi",
    "vbscript:msgbox",
    "//evil.example",
    "/relative",
    "mailto:a@b.c",
    "javascript://%0aalert(1)",
    "https://user@evil.example",
    "https://:80",
    "https://a%zz",
    "https://",
    "ftp://example.com",
    `https://example.com/${"a".repeat(2048)}`,
  ])("rejects %s", (raw) => {
    expect(safeButtonUrl(raw)).toBeNull();
  });
});
