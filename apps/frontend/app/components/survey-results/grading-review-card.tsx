"use client";

import { useState } from "react";
import { Check, Save, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { useReviewResponse } from "@/app/hooks/survey";
import { useSaveAfterPause } from "@/app/hooks/use-save-after-pause";
import { useTranslation } from "@/app/i18n/context";
import { formatResultCode, respondentLabel } from "@/app/lib/survey/grading";
import type { SurveyResponseDto } from "@/app/types/survey";

const MAX_BONUS = 1000;
const MAX_FEEDBACK = 5000;

interface ReviewCardProps {
  surveyId: string;
  response: SurveyResponseDto;
  position: string;
  onNext?: () => void;
}

export function ReviewCard({ surveyId, response, position, onNext }: ReviewCardProps) {
  const { t } = useTranslation();
  const review = useReviewResponse(surveyId);
  const [bonus, setBonus] = useState(response.bonusPoints != null ? String(response.bonusPoints) : "");
  const [feedback, setFeedback] = useState(response.feedback ?? "");
  const [saved, setSaved] = useState(false);
  const [bonusDirty, setBonusDirty] = useState(false);
  const [bonusFailed, setBonusFailed] = useState(false);
  const bonusValue = parseBonus(bonus);
  const invalid = bonusValue === "invalid";

  function save(announce: boolean, then?: () => void) {
    if (bonusValue === "invalid") return;
    setBonusDirty(false);
    review.mutate(
      { responseId: response.id, review: { bonusPoints: bonusValue, feedback: feedback.trim() || null } },
      {
        onSuccess: () => {
          setSaved(true);
          if (announce) toast.success(t("grading.reviewSaved"));
          then?.();
        },
        onError: (err) => {
          setBonusDirty(true);
          setBonusFailed(true);
          toast.error(err instanceof Error ? err.message : t("grading.saveFailed"));
        },
      },
    );
  }

  function saveBonus() {
    if (bonusDirty) save(false);
  }

  useSaveAfterPause(bonus, bonusDirty && !invalid && !review.isPending && !bonusFailed, saveBonus);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div className="grid min-w-0 gap-0.5">
          <CardTitle className="text-base font-medium">{t("grading.summary")}</CardTitle>
          <p className="truncate text-sm text-muted-foreground">
            <span>{respondentLabel(response, t)}</span> · {position}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xl font-semibold tabular-nums">
            {t("grading.total")}: {response.score ?? 0}/{response.maxScore ?? 0}
          </span>
          {response.grade && <Badge>{response.grade}</Badge>}
          {response.gradingPending && <Badge variant="secondary">{t("grading.pending")}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-1">
          <Label htmlFor={`bonus-${response.id}`}>{t("grading.bonus")}</Label>
          <Input
            id={`bonus-${response.id}`}
            type="number"
            inputMode="numeric"
            step={1}
            min={-MAX_BONUS}
            max={MAX_BONUS}
            className="w-28 tabular-nums"
            aria-invalid={invalid}
            value={bonus}
            onChange={(e) => {
              setBonus(e.target.value);
              setBonusDirty(true);
              setBonusFailed(false);
              setSaved(false);
            }}
            onBlur={saveBonus}
          />
          <p className={invalid ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {t("grading.bonusHelp", { max: String(MAX_BONUS) })}
          </p>
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`feedback-${response.id}`}>{t("grading.feedback")}</Label>
          <Textarea
            id={`feedback-${response.id}`}
            rows={4}
            maxLength={MAX_FEEDBACK}
            placeholder={t("grading.feedbackPlaceholder")}
            value={feedback}
            onChange={(e) => {
              setFeedback(e.target.value);
              setSaved(false);
            }}
          />
        </div>
        {response.resultCode && (
          <p className="text-sm text-muted-foreground">
            {t("grading.resultCode")}:{" "}
            <span className="font-mono font-medium text-foreground">
              {formatResultCode(response.resultCode)}
            </span>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={invalid} onClick={() => save(true)}>
            <Save className="size-4" /> {t("grading.saveReview")}
          </Button>
          {onNext && (
            <Button variant="secondary" disabled={invalid} onClick={() => save(true, onNext)}>
              <SkipForward className="size-4" /> {t("grading.saveAndNext")}
            </Button>
          )}
          {saved && !bonusDirty && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Check className="size-4" /> {t("grading.saved")}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function parseBonus(text: string): number | null | "invalid" {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isInteger(n) && Math.abs(n) <= MAX_BONUS ? n : "invalid";
}
