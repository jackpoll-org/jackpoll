"use client";

import { useEffect, useState } from "react";
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
import { useTranslation } from "@/app/i18n/context";
import type { Survey, UpdateSurveyRequest } from "@/app/types/survey";

const SLOTS = 10;

/** Resolve a theme CSS variable (e.g. an oklch chart color) to a `#rrggbb`
 *  hex string, since `<input type="color">` only accepts hex. Uses the
 *  browser's own color resolution rather than parsing oklch by hand. */
function cssVarToHex(varName: string): string {
  if (typeof document === "undefined") return "#000000";
  const probe = document.createElement("div");
  probe.style.color = `var(${varName})`;
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  const nums = rgb.match(/\d+/g);
  if (!nums || nums.length < 3) return "#000000";
  const [r, g, b] = nums.map(Number);
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function toUpdateRequest(survey: Survey, colorPalette: string[] | null): UpdateSurveyRequest {
  return {
    title: survey.title,
    description: survey.description,
    status: survey.status,
    settings: { ...survey.settings, colorPalette },
    questions: survey.questions,
    sections: survey.sections,
    languages: survey.languages,
    defaultLanguage: survey.defaultLanguage,
    i18n: survey.i18n,
  };
}

interface ChartColorsDialogProps {
  survey: Survey;
}

/** Lets the owner override the default theme chart palette per survey (#). */
export function ChartColorsDialog({ survey }: ChartColorsDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [colors, setColors] = useState<string[]>([]);
  const updateSurvey = useUpdateSurvey(survey.id);

  useEffect(() => {
    if (!open) return;
    const existing = survey.settings.colorPalette;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColors(
      existing && existing.length > 0
        ? Array.from({ length: SLOTS }, (_, i) => existing[i % existing.length])
        : Array.from({ length: SLOTS }, (_, i) => cssVarToHex(`--chart-${i + 1}`)),
    );
  }, [open, survey.settings.colorPalette]);

  function setColor(i: number, value: string) {
    setColors((prev) => prev.map((c, idx) => (idx === i ? value : c)));
  }

  async function save() {
    try {
      await updateSurvey.mutateAsync(toUpdateRequest(survey, colors));
      toast.success(t("results.colors.saved"));
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  }

  async function reset() {
    try {
      await updateSurvey.mutateAsync(toUpdateRequest(survey, null));
      toast.success(t("results.colors.reset"));
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Palette className="size-4" />
          {t("results.colors.customize")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("results.colors.title")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t("results.colors.help")}</p>
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
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={reset} disabled={updateSurvey.isPending}>
            {t("results.colors.useDefault")}
          </Button>
          <Button onClick={save} disabled={updateSurvey.isPending}>
            {updateSurvey.isPending && <Spinner className="size-4" />}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
