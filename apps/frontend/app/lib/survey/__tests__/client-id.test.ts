import { describe, it, expect, beforeEach } from "vitest";
import { getClientId } from "../client-id";

describe("getClientId", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns a stable id across calls", () => {
    const first = getClientId();
    const second = getClientId();
    expect(first).toBeTruthy();
    expect(first).toBe(second);
  });

  it("persists the id to localStorage", () => {
    const id = getClientId();
    expect(window.localStorage.getItem("survey-client-id")).toBe(id);
  });
});
