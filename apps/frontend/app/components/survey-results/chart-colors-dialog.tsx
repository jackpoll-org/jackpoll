"use client";

import { useState, type ReactNode } from "react";
import { Palette } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { Spinner } from "@/app/components/ui/spinner";
import { useUpdateSurvey } from "@/app/hooks/survey";
import { getSurveyApi } from "@/app/lib/survey/api";
import { localizeServerError } from "@/app/i18n/server-errors";
import { resolvePalette, toLongHex } from "@/app/lib/results/palette";
import { useTranslation } from "@/app/i18n/context";
import type { Question, Survey, UpdateSurveyRequest } from "@/app/types/survey";

export const SLOTS = 10;

function cssVarToHex(varName: string): string {
  if (typeof document === "undefined") return "#000000";
  const probe = document.createElement("div");
  probe.style.color = `var(${varName})`;
  document.body.appendChild(probe);
  const color = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!ctx) return "#000000";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function toUpdateRequest(survey: Survey): UpdateSurveyRequest {
  return {
    title: survey.title,
    description: survey.description,
    status: survey.status,
    settings: survey.settings,
    questions: survey.questions,
    sections: survey.sections,
    languages: survey.languages,
    defaultLanguage: survey.defaultLanguage,
    i18n: survey.i18n,
  };
}

function useSaveLatestSurvey(surveyId: string) {
  const updateSurvey = useUpdateSurvey(surveyId);
  return async (change: (survey: Survey) => Survey) => {
    const latest = await getSurveyApi(surveyId);
    if (!latest.success || !latest.data) {
      throw new Error(localizeServerError(latest.error ?? "Failed to load survey"));
    }
    await updateSurvey.mutateAsync(toUpdateRequest(change(latest.data)));
  };
}

export function withQuestionPalette(question: Question, colorPalette: string[] | null): Question {
  const settings = { ...question.settings };
  if (colorPalette) settings.colorPalette = colorPalette;
  else delete settings.colorPalette;
  return { ...question, settings };
}

interface PaletteDialogProps {
  trigger: ReactNode;
  title: string;
  help: string;
  palette: string[] | null;
  resetLabel: string;
  savedMessage: string;
  resetMessage: string;
  onSave: (palette: string[] | null) => Promise<void>;
  preview?: (colors: string[]) => ReactNode;
}

export function PaletteDialog({
  trigger,
  title,
  help,
  palette,
  resetLabel,
  savedMessage,
  resetMessage,
  onSave,
  preview,
}: PaletteDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [colors, setColors] = useState<string[]>([]);

  function handleOpenChange(next: boolean) {
    if (next) {
      setColors(
        palette && palette.length > 0
          ? Array.from({ length: SLOTS }, (_, i) => toLongHex(palette[i % palette.length]))
          : Array.from({ length: SLOTS }, (_, i) => cssVarToHex(`--chart-${i + 1}`)),
      );
    }
    setOpen(next);
  }

  function setColor(i: number, value: string) {
    setColors((prev) => prev.map((c, idx) => (idx === i ? value : c)));
  }

  async function submit(next: string[] | null, message: string) {
    setSaving(true);
    try {
      await onSave(next);
      toast.success(message);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{help}</p>
        <div className="grid grid-cols-5 gap-3">
          {colors.map((c, i) => (
            <div key={i} className="grid gap-1">
              <Label htmlFor={`chart-color-${i}`} className="text-xs text-muted-foreground">
                {i + 1}
              </Label>
              <input
                id={`chart-color-${i}`}
                type="color"
                value={c}
                onChange={(e) => setColor(i, e.target.value)}
                className="h-9 w-full cursor-pointer rounded-md border"
              />
            </div>
          ))}
        </div>
        {preview?.(colors)}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => submit(null, resetMessage)} disabled={saving}>
            {resetLabel}
          </Button>
          <Button onClick={() => submit(colors, savedMessage)} disabled={saving}>
            {saving && <Spinner className="size-4" />}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Lets the owner override the default theme chart palette per survey (#). */
export function ChartColorsDialog({ survey }: { survey: Survey }) {
  const { t } = useTranslation();
  const saveLatest = useSaveLatestSurvey(survey.id);
  return (
    <PaletteDialog
      trigger={
        <Button variant="outline" size="sm">
          <Palette className="size-4" />
          {t("results.colors.customize")}
        </Button>
      }
      title={t("results.colors.title")}
      help={t("results.colors.help")}
      palette={resolvePalette(null, survey.settings.colorPalette)}
      resetLabel={t("results.colors.useDefault")}
      savedMessage={t("results.colors.saved")}
      resetMessage={t("results.colors.reset")}
      onSave={(colorPalette) =>
        saveLatest((latest) => ({ ...latest, settings: { ...latest.settings, colorPalette } }))
      }
    />
  );
}

export function QuestionColorsDialog({ survey, questionId }: { survey: Survey; questionId: string }) {
  const { t } = useTranslation();
  const saveLatest = useSaveLatestSurvey(survey.id);
  const question = survey.questions.find((q) => q.id === questionId);
  return (
    <PaletteDialog
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={t("results.colors.question.customize")}
          title={t("results.colors.question.customize")}
        >
          <Palette className="size-4" />
        </Button>
      }
      title={t("results.colors.question.customize")}
      help={t("results.colors.question.help")}
      palette={resolvePalette(question, survey.settings.colorPalette)}
      resetLabel={t("results.colors.question.useSurvey")}
      savedMessage={t("results.colors.saved")}
      resetMessage={t("results.colors.question.reset")}
      onSave={(colorPalette) =>
        saveLatest((latest) => ({
          ...latest,
          questions: latest.questions.map((q) =>
            q.id === questionId ? withQuestionPalette(q, colorPalette) : q,
          ),
        }))
      }
    />
  );
}
