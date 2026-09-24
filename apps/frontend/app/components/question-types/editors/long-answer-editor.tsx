"use client";

import { Textarea } from "@/app/components/ui/textarea";
import { useTranslation } from "@/app/i18n/context";

/** Long answer has no extra configuration — show a disabled preview of the field. */
export function LongAnswerEditor() {
  const { t } = useTranslation();
  return (
    <div className="grid gap-2">
      <span className="text-sm text-muted-foreground">
        {t("qedit.long.help")}
      </span>
      <Textarea disabled rows={4} placeholder={t("qedit.long.placeholder")} />
    </div>
  );
}
