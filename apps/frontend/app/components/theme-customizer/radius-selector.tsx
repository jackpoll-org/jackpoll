"use client";

import { BanIcon } from "lucide-react";
import { useThemeConfig } from "@/app/components/active-theme";
import { useTranslation } from "@/app/i18n/context";
import type { ThemeRadius } from "@/app/lib/themes";
import { ThemeToggleField, type ToggleOption } from "./theme-toggle-field";

const RADII: ReadonlyArray<ToggleOption<ThemeRadius>> = [
  { value: "none", content: <BanIcon /> },
  { value: "sm", content: "SM" },
  { value: "md", content: "MD" },
  { value: "lg", content: "LG" },
  { value: "xl", content: "XL" },
];

export function ThemeRadiusSelector() {
  const { theme, setTheme } = useThemeConfig();
  const { t } = useTranslation();

  return (
    <ThemeToggleField
      label={t("theme.radius")}
      value={theme.radius}
      options={RADII}
      onChange={(radius) => setTheme({ ...theme, radius })}
    />
  );
}
