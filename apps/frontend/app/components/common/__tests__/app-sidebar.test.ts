import { describe, it, expect } from "vitest";
import { isNavItemActive } from "../app-sidebar";

describe("isNavItemActive", () => {
  it("matches the exact path", () => {
    expect(isNavItemActive("/surveys", "/surveys")).toBe(true);
  });

  it("matches nested paths", () => {
    expect(isNavItemActive("/surveys/abc/edit", "/surveys")).toBe(true);
  });

  it("does not match unrelated paths", () => {
    expect(isNavItemActive("/settings", "/surveys")).toBe(false);
  });

  it("does not match a path that only shares a prefix segment", () => {
    expect(isNavItemActive("/surveys-archive", "/surveys")).toBe(false);
  });
});
