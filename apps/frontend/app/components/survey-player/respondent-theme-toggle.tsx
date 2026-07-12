"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/app/components/ui/button";
import { useTranslation } from "@/app/i18n/context";

/**
 * Light/dark toggle for respondents inside a survey (not the full theme
 * changer). Uses next-themes so it only flips the colour mode for this viewer.
 */
export function RespondentThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useTranslation();
  const dark = resolvedTheme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t(dark ? "theme.mode.light" : "theme.mode.dark")}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
