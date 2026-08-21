"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, BarChart3, Copy, Play } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Spinner } from "@/app/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import type { SurveyStatus } from "@/app/types/survey";
import { useDuplicateSurvey } from "@/app/hooks/survey";
import { useTranslation } from "@/app/i18n/context";
import type { TranslationKey } from "@/app/i18n/translations";
import { isQuizGame } from "@/app/lib/live/quiz-game";
import { useBuilder } from "./builder-context";
import { CollabTextInput } from "./collab-text-input";
import { EmbedDialog } from "./embed-dialog";
import { CollaboratorsDialog } from "./collaborators-dialog";
import { PresenceAvatars } from "./presence-avatars";
import { SaveTemplateDialog } from "./save-template-dialog";

const STATUSES: SurveyStatus[] = ["draft", "published", "closed"];

const STATUS_LABEL_KEY: Record<SurveyStatus, TranslationKey> = {
  draft: "builder.status.draft",
  published: "builder.status.published",
  closed: "builder.status.closed",
};

interface BuilderHeaderProps {
  onSave: () => void;
  isSaving: boolean;
  /** Owner-only actions (Share, Results, Collaborators…) — hidden for #22 link editors. */
  ownerActions?: boolean;
}

export function BuilderHeader({
  onSave,
  isSaving,
  ownerActions = true,
}: BuilderHeaderProps) {
  const { survey, dirty, updateMeta, attemptedSave } = useBuilder();
  const titleMissing = attemptedSave && !survey.title.trim();
  const { t } = useTranslation();
  const router = useRouter();
  const duplicateSurvey = useDuplicateSurvey();

  async function handleDuplicate() {
    try {
      const copy = await duplicateSurvey.mutateAsync(survey);
      toast.success(t("card.duplicated"));
      router.push(`/surveys/${copy.id}/edit`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("card.duplicateFailed"));
    }
  }

  return (
    <div className="grid gap-4 rounded-xl border bg-card p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {ownerActions ? (
          <Link
            href="/surveys"
            /* shrink-0: the action buttons next to it would otherwise squeeze
               "Zurück zu den Umfragen" into three stacked words. */
            className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {t("builder.back")}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">
            {t("builder.sharedEditing")}
          </span>
        )}
        {/* Six differently sized buttons wrapping freely left "Save" stranded on
            a line of its own on a phone. Two even columns until sm, then the
            normal inline row. */}
        <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
          <PresenceAvatars />
          {dirty && (
            <span className="text-sm text-muted-foreground">
              {t("builder.unsaved")}
            </span>
          )}
          {ownerActions && (
            <>
              <Button
                variant="outline"
                onClick={handleDuplicate}
                disabled={duplicateSurvey.isPending}
              >
                {duplicateSurvey.isPending ? (
                  <Spinner className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                {t("builder.duplicate")}
              </Button>
              <SaveTemplateDialog />
              <CollaboratorsDialog surveyId={survey.id} />
              <EmbedDialog surveyId={survey.id} status={survey.status} />
              <Button asChild variant="outline">
                <Link href={`/surveys/${survey.id}/results`}>
                  <BarChart3 className="size-4" />
                  {t("builder.results")}
                </Link>
              </Button>
              {isQuizGame(survey.settings) && (
                <Button asChild>
                  <Link href={`/surveys/${survey.id}/present`}>
                    <Play className="size-4" />
                    {t("builder.startGame")}
                  </Link>
                </Button>
              )}
            </>
          )}
          <Button onClick={onSave} disabled={isSaving || !dirty}>
            {isSaving && <Spinner className="size-4" />}
            {t("common.save")}
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="builder-title">
          {t("builder.title")}
          <span className="text-destructive" aria-label={t("builder.required")}> *</span>
        </Label>
        <CollabTextInput
          id="builder-title"
          field="title"
          value={survey.title}
          onChange={(v) => updateMeta({ title: v })}
          placeholder={t("builder.titlePlaceholder")}
          className={
            titleMissing
              ? "text-lg font-semibold border-destructive focus-visible:ring-destructive"
              : "text-lg font-semibold"
          }
          aria-invalid={titleMissing}
        />
        {titleMissing && (
          <p className="text-sm text-destructive">{t("builder.validation.surveyTitle")}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="builder-description">{t("builder.description")}</Label>
        <Textarea
          id="builder-description"
          value={survey.description ?? ""}
          onChange={(e) => updateMeta({ description: e.target.value })}
          placeholder={t("builder.descriptionPlaceholder")}
        />
      </div>

      <div className="grid w-48 gap-2">
        <Label htmlFor="builder-status">{t("builder.status")}</Label>
        <Select
          value={survey.status}
          onValueChange={(value) => updateMeta({ status: value as SurveyStatus })}
        >
          <SelectTrigger id="builder-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {t(STATUS_LABEL_KEY[status])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
