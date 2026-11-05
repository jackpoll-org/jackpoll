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
import { useTranslation } from "@/app/i18n/context";
import { formatResultCode } from "@/app/lib/survey/grading";
import type { SurveyResponseDto } from "@/app/types/survey";

const MAX_BONUS = 1000;
const MAX_FEEDBACK = 5000;

interface ReviewCardProps {
  surveyId: string;
  response: SurveyResponseDto;
  onNext?: () => void;
}

export function ReviewCard({ surveyId, response, onNext }: ReviewCardProps) {
  const { t } = useTranslation();
  const review = useReviewResponse(surveyId);
  const [bonus, setBonus] = useState(response.bonusPoints != null ? String(response.bonusPoints) : "");
  const [feedback, setFeedback] = useState(response.feedback ?? "");
  const [saved, setSaved] = useState(false);
  const bonusValue = parseBonus(bonus);
  const invalid = bonusValue === "invalid";

  function save(then?: () => void) {
    if (bonusValue === "invalid") return;
    review.mutate(
      { responseId: response.id, review: { bonusPoints: bonusValue, feedback: feedback.trim() || null } },
      {
        onSuccess: () => {
          setSaved(true);
          toast.success(t("grading.reviewSaved"));
          then?.();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : t("grading.saveFailed")),
      },
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-base font-medium">{t("grading.summary")}</CardTitle>
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
              setSaved(false);
            }}
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
          <Button disabled={invalid || review.isPending} onClick={() => save()}>
            <Save className="size-4" /> {t("grading.saveReview")}
          </Button>
          {onNext && (
            <Button variant="secondary" disabled={invalid || review.isPending} onClick={() => save(onNext)}>
              <SkipForward className="size-4" /> {t("grading.saveAndNext")}
            </Button>
          )}
          {saved && (
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
