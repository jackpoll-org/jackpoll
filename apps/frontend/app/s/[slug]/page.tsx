"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError } from "@/app/lib/survey/api";
import { SurveyPlayer } from "@/app/components/survey-player/survey-player";
import { usePublicLink } from "@/app/hooks/survey";
import { Spinner } from "@/app/components/ui/spinner";
import { RespondentThemeToggle } from "@/app/components/survey-player/respondent-theme-toggle";
import { surveyBackgroundStyle } from "@/app/components/survey-player/branding-frame";
import { useTranslation } from "@/app/i18n/context";

/**
 * Public response page reached via a shareable link slug (issue #16).
 * Resolves the slug to its survey, or shows an unavailable state when the link
 * is unknown, rotated or expired.
 */
export default function ShareLinkPage() {
  const params = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const { data: survey, isLoading, isError, error } = usePublicLink(params.slug);

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  if (isError || !survey) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : t("player.linkUnavailable")}
          </p>
          {error instanceof ApiError && error.status === 403 && (
            <Link href="/join" className="text-sm font-medium underline underline-offset-4">
              {t("join.title")}
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background px-4 py-8" style={surveyBackgroundStyle(survey)}>
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-4 flex justify-end gap-1">
          <RespondentThemeToggle />
        </div>
        <SurveyPlayer survey={survey} analytics />
      </div>
    </div>
  );
}
