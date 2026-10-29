import { describe, it, expect, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));

import { negotiateLocale } from "../server";
import { DEFAULT_LOCALE } from "../translations";

describe("negotiateLocale", () => {
  it("keeps a language the visitor picked", () => {
    expect(negotiateLocale("en", "de-DE,de;q=0.9")).toBe("en");
  });

  it("follows the device language when nothing was picked (jackpoll#20)", () => {
    expect(negotiateLocale(undefined, "de-AT,de;q=0.9,en;q=0.8")).toBe("de");
    expect(negotiateLocale(undefined, "en-GB,en;q=0.9")).toBe("en");
  });

  it("takes the most preferred supported language", () => {
    expect(negotiateLocale(undefined, "fr-FR,fr;q=0.9,de;q=0.5,en;q=0.7")).toBe("en");
  });

  it("falls back to English for unsupported device languages", () => {
    expect(negotiateLocale(undefined, "fr-FR,fr;q=0.9")).toBe("en");
  });

  it("ignores languages the device refused and invalid cookies", () => {
    expect(negotiateLocale("xx", "de;q=0,en")).toBe("en");
  });

  it("uses the default without any hint", () => {
    expect(negotiateLocale(undefined, null)).toBe(DEFAULT_LOCALE);
  });
});
