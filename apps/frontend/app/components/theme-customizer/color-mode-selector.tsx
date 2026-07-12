"use client";

import { useTheme } from "next-themes";
import { useTranslation } from "@/app/i18n/context";
import { hSelection } from "@/app/lib/native/haptics";
import { ThemeToggleField, type ToggleOption } from "./theme-toggle-field";

type ColorMode = "light" | "system" | "dark";

export function ColorModeSelector() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  const options: ReadonlyArray<ToggleOption<ColorMode>> = [
    { value: "light", content: t("theme.mode.light") },
    { value: "system", content: t("theme.mode.system") },
    { value: "dark", content: t("theme.mode.dark") },
  ];

  return (
    <ThemeToggleField
      label={t("theme.colorMode")}
      value={(theme as ColorMode) ?? "system"}
      options={options}
      onChange={(mode) => {
        setTheme(mode);
        void hSelection();
      }}
    />
  );
}
