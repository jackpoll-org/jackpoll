"use client";

import { Label } from "@/app/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group";
import { useTranslation } from "@/app/i18n/context";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/app/i18n/translations";
import { hSelection } from "@/app/lib/native/haptics";

/**
 * Language picker embedded in the theme panel. Lives here (instead of a
 * standalone header control) so the auth/legal navbar no longer overflows.
 */
export function LanguageSelector() {
  const { locale, setLocale, t } = useTranslation();

  return (
    <div className="flex flex-col gap-3">
      <Label>{t("lang.label")}:</Label>
      <ToggleGroup
        className="w-full"
        type="single"
        value={locale}
        onValueChange={(value) => {
          if (value) {
            setLocale(value as Locale);
            void hSelection();
          }
        }}
        aria-label={t("lang.label")}
      >
        {LOCALES.map((l) => (
          <ToggleGroupItem
            key={l}
            variant="outline"
            className="grow"
            value={l}
            aria-label={t(l === "de" ? "lang.de" : "lang.en")}
          >
            {LOCALE_LABELS[l]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
