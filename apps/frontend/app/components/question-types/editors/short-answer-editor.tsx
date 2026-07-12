"use client";

import { Input } from "@/app/components/ui/input";
import { useTranslation } from "@/app/i18n/context";

/** Short answer has no extra configuration — show a disabled preview of the field. */
export function ShortAnswerEditor() {
  const { t } = useTranslation();
  return (
    <div className="grid gap-2">
      <span className="text-sm text-muted-foreground">
        {t("qedit.short.help")}
      </span>
      <Input disabled placeholder={t("qedit.short.placeholder")} />
    </div>
  );
}
