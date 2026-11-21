"use client";

import { useState } from "react";
import { CalendarClock, CopyPlus, Link2, Pencil, Plus, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Spinner } from "@/app/components/ui/spinner";
import { useBuilder } from "./builder-context";
import { RunDialog } from "./run-dialog";
import { useCurrentUser } from "@/app/hooks/auth";
import { useShareLink } from "@/app/hooks/survey";
import {
  useCloseRun,
  useCreateRun,
  useDeleteRun,
  useDuplicateRun,
  useRuns,
  useUpdateRun,
} from "@/app/hooks/runs";
import { useTranslation } from "@/app/i18n/context";
import type { TranslationKey } from "@/app/i18n/translations";
import { ApiError } from "@/app/lib/survey/api";
import { formatAbsolute } from "@/app/lib/survey/format";
import { addOneYear } from "@/app/lib/survey/runs";
import type { Run, RunRequest } from "@/app/types/survey";

type DialogState = { mode: "create" } | { mode: "edit" | "duplicate"; run: Run } | null;

const STATUS_VARIANT = { open: "default", scheduled: "secondary", closed: "outline" } as const;

const RUN_ERROR_KEYS: Record<string, TranslationKey> = {
  RUN_STARTED: "runs.error.started",
  RUN_HAS_RESPONSES: "runs.error.hasResponses",
  RUN_LIMIT: "runs.error.limit",
};

export function RunOpenBanner({ surveyId }: { surveyId: string }) {
  const { t } = useTranslation();
  const runs = useRuns(surveyId);
  if (!runs.data?.some((r) => r.status === "open")) return null;
  return (
    <Alert className="mt-4">
      <CalendarClock className="size-4" />
      <AlertDescription>{t("runs.openBanner")}</AlertDescription>
    </Alert>
  );
}

export function RunsCard() {
  const { t, locale } = useTranslation();
  const { survey } = useBuilder();
  const user = useCurrentUser();
  const isOwner = !!user.data?.id && user.data.id === survey.ownerId;
  const runs = useRuns(survey.id);
  const shareLink = useShareLink(survey.id, survey.status === "published");
  const createRun = useCreateRun(survey.id);
  const updateRun = useUpdateRun(survey.id);
  const closeRun = useCloseRun(survey.id);
  const duplicateRun = useDuplicateRun(survey.id);
  const deleteRun = useDeleteRun(survey.id);
  const [dialog, setDialog] = useState<DialogState>(null);

  async function run(action: () => Promise<unknown>, success: TranslationKey) {
    try {
      await action();
      toast.success(t(success));
      return true;
    } catch (err) {
      const key = err instanceof ApiError && err.reason ? RUN_ERROR_KEYS[err.reason] : undefined;
      toast.error(key ? t(key) : err instanceof Error ? err.message : t("common.saveFailed"));
      return false;
    }
  }

  async function submitDialog(data: RunRequest) {
    if (!dialog) return;
    const ok =
      dialog.mode === "create"
        ? await run(() => createRun.mutateAsync(data), "runs.created")
        : dialog.mode === "edit"
          ? await run(() => updateRun.mutateAsync({ id: dialog.run.id, data }), "runs.updated")
          : await run(() => duplicateRun.mutateAsync({ id: dialog.run.id, data }), "runs.created");
    if (ok) setDialog(null);
  }

  async function copyLink(id: string) {
    const slug = shareLink.data?.slug;
    if (!slug) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/s/${slug}?run=${encodeURIComponent(id)}`,
      );
      toast.success(t("share.link.copied"));
    } catch {
      toast.error(t("common.copyFailed"));
    }
  }

  function dialogInitial(): RunRequest | undefined {
    if (!dialog || dialog.mode === "create") return undefined;
    const { label, opensAt, closesAt } = dialog.run;
    return dialog.mode === "edit"
      ? { label, opensAt, closesAt }
      : { label, opensAt: addOneYear(opensAt), closesAt: addOneYear(closesAt) };
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">{t("runs.title")}</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setDialog({ mode: "create" })}>
          <Plus className="size-4" />
          {t("runs.add")}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-xs text-muted-foreground">{t("runs.help")}</p>
        <p className="text-xs text-muted-foreground">{t("runs.surveyWindowNote")}</p>
        {survey.settings.requireRespondentToken && (
          <p className="text-xs text-muted-foreground">{t("runs.tokensNote")}</p>
        )}
        {runs.isLoading && <Spinner className="size-5" />}
        {runs.isError && (
          <p className="text-sm text-destructive">
            {runs.error instanceof Error ? runs.error.message : t("runs.loadFailed")}
          </p>
        )}
        {runs.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("runs.empty")}</p>
        )}
        {runs.data?.map((r) => (
          <div
            key={r.id}
            data-testid="run-row"
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
          >
            <div className="grid min-w-0 gap-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{r.label}</span>
                <Badge variant={STATUS_VARIANT[r.status]}>{t(`runs.status.${r.status}`)}</Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatAbsolute(r.opensAt, locale)} – {formatAbsolute(r.closesAt, locale)} ·{" "}
                {t("runs.responses", { count: String(r.responseCount) })}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("runs.copyLink")}
                title={t("runs.copyLink")}
                disabled={!shareLink.data?.slug}
                onClick={() => copyLink(r.id)}
              >
                <Link2 className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("common.edit")}
                title={t("common.edit")}
                onClick={() => setDialog({ mode: "edit", run: r })}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("runs.duplicate")}
                title={t("runs.duplicate")}
                onClick={() => setDialog({ mode: "duplicate", run: r })}
              >
                <CopyPlus className="size-4" />
              </Button>
              {r.status !== "closed" && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t("runs.close")}
                  title={t("runs.close")}
                  disabled={closeRun.isPending}
                  onClick={() => {
                    if (window.confirm(t("runs.closeConfirm"))) {
                      void run(() => closeRun.mutateAsync(r.id), "runs.closed");
                    }
                  }}
                >
                  <Square className="size-4" />
                </Button>
              )}
              {isOwner && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t("common.delete")}
                  title={r.responseCount > 0 ? t("runs.deleteDisabled") : t("common.delete")}
                  disabled={r.responseCount > 0 || deleteRun.isPending}
                  onClick={() => {
                    if (window.confirm(t("runs.deleteConfirm"))) {
                      void run(() => deleteRun.mutateAsync(r.id), "runs.deleted");
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
      {dialog && (
        <RunDialog
          key={dialog.mode === "create" ? "create" : `${dialog.mode}-${dialog.run.id}`}
          title={t(`runs.dialog.${dialog.mode}`)}
          initial={dialogInitial()}
          pending={createRun.isPending || updateRun.isPending || duplicateRun.isPending}
          onSubmit={submitDialog}
          onClose={() => setDialog(null)}
        />
      )}
    </Card>
  );
}
