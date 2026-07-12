import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePreference } from "@/app/hooks/use-preference";

beforeEach(() => {
  localStorage.clear();
  // Clear cookies between tests.
  document.cookie.split(";").forEach((c) => {
    document.cookie = `${c.split("=")[0].trim()}=; path=/; max-age=0`;
  });
});

describe("usePreference (localStorage backend)", () => {
  it("returns the default, then becomes ready", async () => {
    const { result } = renderHook(() =>
      usePreference<string>({ key: "pref_x", defaultValue: "a" }),
    );
    expect(result.current[0]).toBe("a");
    await waitFor(() => expect(result.current[2]).toBe(true));
  });

  it("reads a persisted value on mount", async () => {
    localStorage.setItem("pref_y", "stored");
    const { result } = renderHook(() =>
      usePreference<string>({ key: "pref_y", defaultValue: "fallback" }),
    );
    await waitFor(() => expect(result.current[0]).toBe("stored"));
  });

  it("persists writes to localStorage", async () => {
    const { result } = renderHook(() =>
      usePreference<string>({ key: "pref_z", defaultValue: "a" }),
    );
    await waitFor(() => expect(result.current[2]).toBe(true));
    act(() => result.current[1]("b"));
    expect(result.current[0]).toBe("b");
    expect(localStorage.getItem("pref_z")).toBe("b");
  });
});

describe("usePreference (cookie backend + body attr)", () => {
  afterEach(() => {
    document.body.removeAttribute("data-test-attr");
  });

  it("writes a cookie and toggles the body attribute by truthiness", async () => {
    const { result } = renderHook(() =>
      usePreference<boolean>({
        key: "pref_flag",
        defaultValue: false,
        backend: "cookie",
        bodyAttr: "data-test-attr",
        serialize: (v) => (v ? "1" : ""),
        deserialize: (s) => s === "1",
      }),
    );
    await waitFor(() => expect(result.current[2]).toBe(true));

    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    expect(document.cookie).toContain("pref_flag=1");
    expect(document.body.hasAttribute("data-test-attr")).toBe(true);

    act(() => result.current[1](false));
    expect(document.body.hasAttribute("data-test-attr")).toBe(false);
  });
});
