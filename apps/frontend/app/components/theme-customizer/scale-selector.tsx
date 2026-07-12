"use client";

import { BanIcon } from "lucide-react";
import { useThemeConfig } from "@/app/components/active-theme";
import { useTranslation } from "@/app/i18n/context";
import type { ThemeScale } from "@/app/lib/themes";
import { ThemeToggleField, type ToggleOption } from "./theme-toggle-field";

const SCALES: ReadonlyArray<ToggleOption<ThemeScale>> = [
  { value: "none", content: <BanIcon /> },
  { value: "sm", content: "XS" },
  { value: "lg", content: "LG" },
];

export function ThemeScaleSelector() {
  const { theme, setTheme } = useThemeConfig();
  const { t } = useTranslation();

  return (
    <ThemeToggleField
      label={t("theme.scale")}
      value={theme.scale}
      options={SCALES}
      onChange={(scale) => setTheme({ ...theme, scale })}
    />
  );
}
