"use client";

import Link from "next/link";
import { Palette, SettingsIcon } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@/app/components/ui/dropdown-menu";
import { PresetSelector } from "./preset-selector";
import { ThemeScaleSelector } from "./scale-selector";
import { ColorModeSelector } from "./color-mode-selector";
import { ThemeRadiusSelector } from "./radius-selector";
import { LanguageSelector } from "./language-selector";
import { ResetThemeButton } from "./reset-theme";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { useTranslation } from "@/app/i18n/context";

export function ThemeCustomizerPanel() {
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label="Theme settings">
          <Palette />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="me-4 w-80 p-4 shadow-xl lg:me-0"
        align={isMobile ? "center" : "end"}>
        <div className="grid space-y-4">
          <PresetSelector />
          <ThemeScaleSelector />
          <ThemeRadiusSelector />
          <ColorModeSelector />
          <LanguageSelector />
        </div>
        <ResetThemeButton />
        <Button asChild variant="ghost" size="sm" className="mt-2 w-full justify-start">
          <Link href="/settings">
            <SettingsIcon className="size-4" />
            {t("settings.more")}
          </Link>
        </Button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
