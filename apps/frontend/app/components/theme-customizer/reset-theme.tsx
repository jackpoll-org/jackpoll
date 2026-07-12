"use client";

import { useThemeConfig } from "@/app/components/active-theme";
import { Button } from "@/app/components/ui/button";
import { useTranslation } from "@/app/i18n/context";
import { DEFAULT_THEME } from "@/app/lib/themes";

export function ResetThemeButton() {
  const { setTheme } = useThemeConfig();
  const { t } = useTranslation();

  return (
    <Button className="mt-4 w-full" onClick={() => setTheme(DEFAULT_THEME)}>
      {t("theme.reset")}
    </Button>
  );
}
