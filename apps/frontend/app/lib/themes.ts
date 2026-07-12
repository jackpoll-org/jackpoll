export const DEFAULT_THEME = {
  preset: "jackpoll",
  radius: "sm",
  scale: "none",
  contentLayout: "full"
} as const;

export type ThemePreset = (typeof THEMES)[number]["value"] | "default";
export type ThemeRadius = "default" | "none" | "sm" | "md" | "lg" | "xl";
export type ThemeScale = "none" | "sm" | "lg";
export type ThemeContentLayout = "full" | "centered";

export type ThemeType = {
  preset: ThemePreset;
  radius: ThemeRadius;
  scale: ThemeScale;
  contentLayout: ThemeContentLayout;
};

export const THEMES = [
  {
    name: "Default",
    value: "default",
    colors: ["oklch(0.33 0 0)"]
  },
  {
    name: "Jackpoll",
    value: "jackpoll",
    colors: ["oklch(0.470 0.176 262)"]
  },
  {
    name: "Midnight",
    value: "midnight",
    colors: ["oklch(0.470 0.176 275)"]
  },
  {
    name: "Ember",
    value: "ember",
    colors: ["oklch(0.470 0.176 50)"]
  },
  {
    name: "Meadow",
    value: "meadow",
    colors: ["oklch(0.470 0.176 150)"]
  },
  {
    name: "Blossom",
    value: "blossom",
    colors: ["oklch(0.470 0.176 350)"]
  },
  {
    name: "Harbor",
    value: "harbor",
    colors: ["oklch(0.470 0.176 200)"]
  },
  {
    name: "Dusk",
    value: "dusk",
    colors: ["oklch(0.470 0.176 300)"]
  },
  {
    name: "Sand",
    value: "sand",
    colors: ["oklch(0.470 0.176 70)"]
  }
];
