"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Switch } from "@/app/components/ui/switch";
import { useTranslation } from "@/app/i18n/context";
import type { GradeStep, SurveySettings } from "@/app/types/survey";

interface GradingSettingsProps {
  surveyId: string;
  settings: SurveySettings;
  onChange: (patch: Partial<SurveySettings>) => void;
}

export function GradingSettings({ surveyId, settings, onChange }: GradingSettingsProps) {
  const { t } = useTranslation();
  const scale = settings.gradingScale ?? [];

  function setScale(next: GradeStep[]) {
    onChange({ gradingScale: next.length > 0 ? next : null });
  }

  function patchStep(i: number, patch: Partial<GradeStep>) {
    setScale(scale.map((step, j) => (j === i ? { ...step, ...patch } : step)));
  }

  function copyResultsLink() {
    const url = `${window.location.origin}/results/${surveyId}`;
    void navigator.clipboard
      .writeText(url)
      .then(() => toast.success(t("builder.grading.linkCopied")))
      .catch(() => toast.error(t("edit.linkCopyFailed")));
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3">
        <div>
          <Label className="text-xs">{t("builder.grading.scale")}</Label>
          <p className="text-xs text-muted-foreground">{t("builder.grading.scaleHelp")}</p>
        </div>
        {scale.map((step, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="grid gap-1">
              <Label htmlFor={`grade-label-${i}`} className="text-xs">
                {t("builder.grading.gradeLabel")}
              </Label>
              <Input
                id={`grade-label-${i}`}
                className="w-32"
                maxLength={50}
                value={step.label}
                onChange={(e) => patchStep(i, { label: e.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`grade-min-${i}`} className="text-xs">
                {t("builder.grading.minScore")}
              </Label>
              <Input
                id={`grade-min-${i}`}
                type="number"
                className="w-28"
                value={step.minScore ?? ""}
                onChange={(e) =>
                  patchStep(i, { minScore: e.target.value ? Number(e.target.value) : null })
                }
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("builder.grading.remove")}
              onClick={() => setScale(scale.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => setScale([...scale, { label: "", minScore: null }])}
        >
          <Plus className="size-4" /> {t("builder.grading.add")}
        </Button>
      </div>

      <div className="grid gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id="student-results"
            checked={settings.studentResults === true}
            onCheckedChange={(c) =>
              onChange({ studentResults: c, ...(c ? {} : { resultsReleased: false }) })
            }
          />
          <Label htmlFor="student-results" className="font-normal">
            {t("builder.grading.studentResults")}
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">{t("builder.grading.studentResultsHelp")}</p>
        {settings.studentResults && (
          <>
            <div className="flex items-center gap-2">
              <Switch
                id="results-released"
                checked={settings.resultsReleased === true}
                onCheckedChange={(c) => onChange({ resultsReleased: c })}
              />
              <Label htmlFor="results-released" className="font-normal">
                {t("builder.grading.release")}
              </Label>
            </div>
            <Button variant="outline" size="sm" className="w-fit" onClick={copyResultsLink}>
              <Copy className="size-4" /> {t("builder.grading.copyLink")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
