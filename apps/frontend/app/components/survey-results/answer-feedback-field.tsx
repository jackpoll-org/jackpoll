"use client";

import { useId, useRef, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/app/components/ui/textarea";
import { useAnswerFeedback } from "@/app/hooks/survey";
import { useTranslation } from "@/app/i18n/context";

const FEEDBACK_LIMIT = 2000;

interface AnswerFeedbackFieldProps {
  surveyId: string;
  questionId: string;
  responseIds: string[];
  initial: string;
  label: string;
  placeholder?: string;
}

export function AnswerFeedbackField({
  surveyId,
  questionId,
  responseIds,
  initial,
  label,
  placeholder,
}: AnswerFeedbackFieldProps) {
  const { t } = useTranslation();
  const feedback = useAnswerFeedback(surveyId);
  const id = useId();
  const [text, setText] = useState(initial);
  const [justSaved, setJustSaved] = useState(false);
  const latest = useRef(initial);
  const saved = useRef(initial);
  const saving = useRef(false);

  function save() {
    const next = latest.current.trim();
    if (saving.current || next === saved.current) return;
    saving.current = true;
    feedback
      .mutateAsync({ questionId, responseIds, feedback: next })
      .then(() => {
        saving.current = false;
        saved.current = next;
        if (latest.current.trim() === next) setJustSaved(true);
        else save();
      })
      .catch((err: unknown) => {
        saving.current = false;
        toast.error(err instanceof Error ? err.message : t("grading.saveFailed"));
      });
  }

  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-sm text-muted-foreground">
          {label}
        </label>
        {justSaved && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Check className="size-3.5" /> {t("grading.saved")}
          </span>
        )}
      </div>
      <Textarea
        id={id}
        rows={2}
        maxLength={FEEDBACK_LIMIT}
        placeholder={placeholder ?? t("grading.answerFeedbackPlaceholder")}
        value={text}
        onChange={(e) => {
          latest.current = e.target.value;
          setText(e.target.value);
          setJustSaved(false);
        }}
        onBlur={save}
      />
    </div>
  );
}
