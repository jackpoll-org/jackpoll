"use client";

import { Input } from "@/app/components/ui/input";
import type { QuestionPreviewProps } from "../types";
import { useTranslation } from "@/app/i18n/context";

export function ShortAnswerPreview({
  value,
  onChange,
  disabled,
}: QuestionPreviewProps) {
  const { t } = useTranslation();
  const interactive = !!onChange;
  return (
    <Input
      placeholder={t("qedit.short.placeholder")}
      disabled={disabled ?? !interactive}
      value={typeof value === "string" ? value : ""}
      onChange={interactive ? (e) => onChange(e.target.value) : undefined}
    />
  );
}
