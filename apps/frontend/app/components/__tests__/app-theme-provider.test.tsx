import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppThemeProvider, useForceLightTheme } from "../app-theme-provider";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

function prefersDark(dark: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: dark,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
}

function ForceLight({ force }: { force: boolean }) {
  useForceLightTheme(force);
  return null;
}

const html = () => document.documentElement.classList;

describe("AppThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    html().remove("light", "dark");
    prefersDark(true);
  });

  afterEach(() => {
    pathname = "/";
  });

  it("follows the system preference on public pages", async () => {
    pathname = "/s/abc";
    render(<AppThemeProvider>x</AppThemeProvider>);
    await waitFor(() => expect(html()).toContain("dark"));
  });

  it("keeps the dashboard light by default", async () => {
    pathname = "/surveys";
    render(<AppThemeProvider>x</AppThemeProvider>);
    await waitFor(() => expect(html()).toContain("light"));
    expect(html()).not.toContain("dark");
  });

  it("keeps the public choice separate from the dashboard choice", async () => {
    localStorage.setItem("theme", "dark");
    localStorage.setItem("public-theme", "light");
    pathname = "/embed/1";
    render(<AppThemeProvider>x</AppThemeProvider>);
    await waitFor(() => expect(html()).toContain("light"));
    expect(html()).not.toContain("dark");
  });

  it("forces light on a public page with a custom background", async () => {
    pathname = "/s/abc";
    const { rerender } = render(
      <AppThemeProvider>
        <ForceLight force />
      </AppThemeProvider>,
    );
    await waitFor(() => expect(html()).toContain("light"));
    rerender(
      <AppThemeProvider>
        <ForceLight force={false} />
      </AppThemeProvider>,
    );
    await waitFor(() => expect(html()).toContain("dark"));
  });
});
