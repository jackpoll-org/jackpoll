"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Survey } from "@/app/types/survey";

interface SurveyLogoProps {
  survey: Survey;
  className?: string;
}

/**
 * The survey's uploaded logo (issue #30) for the live screens — presenter
 * header, lobby and participant phones. Renders nothing without a logo.
 */
export function SurveyLogo({ survey, className }: SurveyLogoProps) {
  const { logoUrl } = survey.settings;
  if (!logoUrl) return null;
  return (
    <div className={cn("relative h-10 w-32 shrink-0", className)}>
      <Image
        src={logoUrl}
        alt=""
        fill
        unoptimized
        sizes="128px"
        className="object-contain object-left"
      />
    </div>
  );
}
