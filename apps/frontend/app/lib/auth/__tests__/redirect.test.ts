import { describe, it, expect } from "vitest";
import { safeInternalPath } from "@/app/lib/auth/redirect";

describe("safeInternalPath", () => {
  it("accepts same-origin absolute paths", () => {
    expect(safeInternalPath("/dashboard")).toBe("/dashboard");
    expect(safeInternalPath("/surveys/123?tab=results")).toBe(
      "/surveys/123?tab=results",
    );
    expect(safeInternalPath("/")).toBe("/");
  });

  it("rejects absolute and protocol-relative URLs (open-redirect guard)", () => {
    expect(safeInternalPath("https://evil.com")).toBeUndefined();
    expect(safeInternalPath("http://evil.com")).toBeUndefined();
    expect(safeInternalPath("//evil.com")).toBeUndefined();
    expect(safeInternalPath("javascript:alert(1)")).toBeUndefined();
  });

  it("rejects backslash-smuggled and control-char values", () => {
    expect(safeInternalPath("/\\evil.com")).toBeUndefined();
    expect(safeInternalPath("/\tevil")).toBeUndefined();
    expect(safeInternalPath("/foo\nbar")).toBeUndefined();
  });

  it("rejects relative and empty values", () => {
    expect(safeInternalPath("dashboard")).toBeUndefined();
    expect(safeInternalPath("")).toBeUndefined();
    expect(safeInternalPath(null)).toBeUndefined();
    expect(safeInternalPath(undefined)).toBeUndefined();
  });
});
