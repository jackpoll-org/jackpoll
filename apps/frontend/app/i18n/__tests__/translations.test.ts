import { describe, it, expect } from "vitest";
import { en, de, fr, translations, LOCALES, DEFAULT_LOCALE } from "../translations";
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

  it("French overrides only use keys that exist in English", () => {
    const enKeys = new Set(Object.keys(en));
    for (const key of Object.keys(fr)) {
      expect(enKeys.has(key)).toBe(true);
    }
  });

  it("has a French translation for every English key outside the English-only areas", () => {
    const englishOnly: string[] = [
    ];
    const missing = Object.keys(en).filter(
      (k) => !(k in fr) && !englishOnly.some((prefix) => k.startsWith(prefix)),
    );
    expect(missing).toEqual([]);
  });
});

describe("placeholders", () => {
  const names = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  it.each([
    ["de", de],
    ["fr", fr],
  ] as const)("%s keeps the English placeholders", (_, dict) => {
    for (const [key, text] of Object.entries(dict)) {
      expect(names(text as string), key).toEqual(names(en[key as keyof typeof en]));
    }
  });
});

describe("locale-aware formatting", () => {
  it("formats numbers per locale", () => {
    expect(formatNumber(1234.5, "de")).toBe("1.234,5");
    expect(formatNumber(1234.5, "en")).toBe("1,234.5");
    expect(formatNumber(1234.5, "fr")).toBe("1\u202f234,5");
  });

  it("formats dates per locale", () => {
    const date = new Date("2026-06-15T00:00:00Z");
    // German uses day-first ordering; English month-first.
    expect(formatDate(date, "de")).not.toBe(formatDate(date, "en"));
  });
});
