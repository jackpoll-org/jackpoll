"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useTranslation } from "@/app/i18n/context";
import type { Survey } from "@/app/types/survey";

/** Override the theme accent for a branded public surface (issue #30). */
export function brandingStyle(survey: Survey): CSSProperties | undefined {
  const accent = survey.settings.accentColor;
  return accent
    ? ({ "--primary": accent, "--ring": accent } as CSSProperties)
    : undefined;
}

/** Custom page background colour the editor set for respondents. */
export function surveyBackgroundStyle(
  survey: Survey,
): CSSProperties | undefined {
  const bg = survey.settings.backgroundColor;
  return bg ? { backgroundColor: bg } : undefined;
}

export function BrandingHeader({ survey }: { survey: Survey }) {
  const { headerImageUrl, logoUrl } = survey.settings;
  if (!headerImageUrl && !logoUrl) return null;
  return (
    <div className="grid gap-3">
      {headerImageUrl && (
        <div className="relative h-32 w-full overflow-hidden rounded-lg border">
          <Image
            src={headerImageUrl}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 768px) 100vw, 672px"
            className="object-cover"
          />
        </div>
      )}
      {logoUrl && (
        <div className="relative h-12 w-40">
          <Image
            src={logoUrl}
            alt=""
            fill
            unoptimized
            sizes="160px"
            className="object-contain object-left"
          />
        </div>
      )}
    </div>
  );
}

export function PoweredBy({ survey }: { survey: Survey }) {
  const { t } = useTranslation();
  if (!survey.settings.showPoweredBy) return null;
  return (
    <p className="pt-2 text-center text-xs text-muted-foreground">
      {t("player.poweredBy")}
    </p>
  );
}
