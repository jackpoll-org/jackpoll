"use client";

import { useParams } from "next/navigation";
import { SurveyPlayer } from "@/app/components/survey-player/survey-player";
import { usePublicSurvey } from "@/app/hooks/survey";
import { Spinner } from "@/app/components/ui/spinner";

/**
 * Public, chrome-free survey view for iframe embedding (issue #7). Renders a
 * published survey; unpublished or unknown surveys return a not-available state.
 */
export default function EmbedPage() {
  const params = useParams<{ id: string }>();
  const { data: survey, isLoading, isError } = usePublicSurvey(params.id);

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  if (isError || !survey) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4 text-center">
        <p className="text-sm text-muted-foreground">
          This survey is not available.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">
        <SurveyPlayer survey={survey} analytics />
      </div>
    </div>
  );
}
