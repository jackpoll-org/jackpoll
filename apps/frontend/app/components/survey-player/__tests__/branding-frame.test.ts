import { describe, expect, it } from "vitest";
import type { Survey } from "@/app/types/survey";
import { brandingStyle } from "../branding-frame";

const survey = (accentColor?: string) => ({ settings: { accentColor } }) as unknown as Survey;

describe("brandingStyle", () => {
  it("pairs a custom accent with a contrasting button text colour", () => {
    expect(brandingStyle(survey("#facc15"))).toEqual({
      "--primary": "#facc15",
      "--ring": "#facc15",
      "--primary-foreground": "#0a0a0a",
    });
    expect(brandingStyle(survey("#1e3a8a"))).toMatchObject({ "--primary-foreground": "#ffffff" });
  });

  it("keeps the theme colours without an accent", () => {
    expect(brandingStyle(survey())).toBeUndefined();
  });
});
