"use client";

import { Textarea } from "@/app/components/ui/textarea";
import type { QuestionPreviewProps } from "../types";
import { useTranslation } from "@/app/i18n/context";

/** Longest paragraph answer the backend accepts (ResponseService.MAX_LONG_ANSWER_LENGTH). */
export const MAX_LONG_ANSWER_LENGTH = 10_000;

/** Multi-line paragraph answer (public #8): grows with its content, keeps line breaks. */
export function LongAnswerPreview({
  value,
  onChange,
  disabled,
}: QuestionPreviewProps) {
  const { t } = useTranslation();
  const interactive = !!onChange;
  return (
    <Textarea
      rows={6}
      maxLength={MAX_LONG_ANSWER_LENGTH}
      className="min-h-36 resize-y"
      placeholder={t("qedit.long.placeholder")}
      disabled={disabled ?? !interactive}
      value={typeof value === "string" ? value : ""}
      onChange={interactive ? (e) => onChange(e.target.value) : undefined}
    />
  );
}
