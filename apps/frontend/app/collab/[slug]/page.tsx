"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SurveyBuilder } from "@/app/components/survey-builder/survey-builder";
import { NamePromptDialog } from "@/app/components/survey-builder/name-prompt-dialog";
import { usePublicCollab } from "@/app/hooks/survey";
import { editCollabApi } from "@/app/lib/survey/api";
import { useAuthContext } from "@/app/components/auth/auth-provider";
import { loadStoredName, makeGuestUser, storeName } from "@/app/lib/collab/identity";
import { Spinner } from "@/app/components/ui/spinner";
import type { Survey, UpdateSurveyRequest } from "@/app/types/survey";

/**
 * Passwordless collaborative editing via a link slug (issue #22). Anyone with
 * the link can edit and save the survey until the owner-set expiry.
 */
export default function CollabPage() {
  const params = useParams<{ slug: string }>();
  const { data: survey, isLoading, isError, error } = usePublicCollab(params.slug);

  // Live co-editing (issue #85) needs a `user` to start the provider. Anonymous
  // link editors get a lightweight guest identity — reuse a stored name, else
  // prompt once.
  const { user, setUser } = useAuthContext();
  const [needsName, setNeedsName] = useState(false);
  useEffect(() => {
    if (user) return;
    const stored = loadStoredName();
    if (stored) setUser(makeGuestUser(stored));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else setNeedsName(true);
  }, [user, setUser]);

  function handleName(name: string) {
    storeName(name);
    setUser(makeGuestUser(name));
    setNeedsName(false);
  }

  async function save(req: UpdateSurveyRequest): Promise<Survey> {
    const res = await editCollabApi(params.slug, req);
    if (!res.success || !res.data) {
      throw new Error(res.error ?? "Failed to save");
    }
    return res.data;
  }

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
          {error instanceof Error ? error.message : "This link is not available."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <NamePromptDialog open={needsName} onSubmit={handleName} />
      <SurveyBuilder survey={survey} save={save} ownerActions={false} />
    </div>
  );
}
