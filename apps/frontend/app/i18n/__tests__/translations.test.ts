import { describe, it, expect } from "vitest";
import { en, de, translations, LOCALES, DEFAULT_LOCALE } from "../translations";
import { formatDate, formatNumber } from "../format";

describe("translation store", () => {
  it("defaults to German", () => {
    expect(DEFAULT_LOCALE).toBe("de");
  });

  it("exposes a dictionary for every locale", () => {
    for (const locale of LOCALES) {
      expect(translations[locale]).toBeDefined();
    }
  });

  it("German overrides only use keys that exist in English", () => {
    const enKeys = new Set(Object.keys(en));
    for (const key of Object.keys(de)) {
      expect(enKeys.has(key)).toBe(true);
    }
  });

  it("has a German translation for every English key (no silent gaps)", () => {
    const missing = Object.keys(en).filter((k) => !(k in de));
    expect(missing).toEqual([]);
  });
});

describe("locale-aware formatting", () => {
  it("formats numbers per locale", () => {
    expect(formatNumber(1234.5, "de")).toBe("1.234,5");
    expect(formatNumber(1234.5, "en")).toBe("1,234.5");
  });

  it("formats dates per locale", () => {
    const date = new Date("2026-06-15T00:00:00Z");
    // German uses day-first ordering; English month-first.
    expect(formatDate(date, "de")).not.toBe(formatDate(date, "en"));
  });
});
