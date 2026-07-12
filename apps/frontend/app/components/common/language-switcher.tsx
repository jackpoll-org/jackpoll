"use client";

import { Languages } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group";
import { useTranslation } from "@/app/i18n/context";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/app/i18n/translations";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  /** Show a leading globe/language icon (e.g. on public pages). */
  withIcon?: boolean;
  /** Stretch the toggle to fill its container (settings row layout, #89). */
  fullWidth?: boolean;
  className?: string;
}

export function LanguageSwitcher({
  withIcon,
  fullWidth,
  className,
}: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useTranslation();

  return (
    <div
      className={cn("flex items-center gap-2", fullWidth && "w-full", className)}
    >
      {withIcon && (
        <Languages className="size-4 text-muted-foreground" aria-hidden />
      )}
      <ToggleGroup
        type="single"
        value={locale}
        onValueChange={(value) => {
          if (value) setLocale(value as Locale);
        }}
        aria-label={t("lang.label")}
        size="sm"
        variant="outline"
        className={cn(fullWidth && "w-full")}
      >
        {LOCALES.map((l) => (
          <ToggleGroupItem
            key={l}
            value={l}
            aria-label={t(l === "de" ? "lang.de" : "lang.en")}
            className={cn("px-2 text-xs font-medium", fullWidth && "grow")}
          >
            {LOCALE_LABELS[l]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
