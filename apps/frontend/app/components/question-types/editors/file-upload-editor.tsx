"use client";

import { Switch } from "@/app/components/ui/switch";
import { Label } from "@/app/components/ui/label";
import { Input } from "@/app/components/ui/input";
import { useTranslation } from "@/app/i18n/context";
import type { QuestionEditorProps } from "../types";

/** Editor for file-upload questions: multiple toggle + max size. */
export function FileUploadEditor({ question, onChange }: QuestionEditorProps) {
  const { t } = useTranslation();
  const multiple = question.settings?.multiple === true;
  const maxSizeMb = Number(question.settings?.maxSizeMb) || 10;

  function patch(p: Record<string, unknown>) {
    onChange({ settings: { ...(question.settings ?? {}), ...p } });
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        {t("qedit.file.allowedTypes")}
      </p>

      <div className="flex items-center gap-2">
        <Switch
          id={`${question.id}-multiple`}
          checked={multiple}
          onCheckedChange={(c) => patch({ multiple: c })}
        />
        <Label htmlFor={`${question.id}-multiple`} className="font-normal">
          {t("qedit.file.allowMultiple")}
        </Label>
      </div>

      <div className="grid gap-1">
        <Label htmlFor={`${question.id}-maxsize`} className="text-xs">
          {t("qedit.file.maxSize")}
        </Label>
        <Input
          id={`${question.id}-maxsize`}
          type="number"
          min={1}
          max={10}
          className="w-32"
          value={maxSizeMb}
          onChange={(e) => patch({ maxSizeMb: Number(e.target.value) || 10 })}
        />
      </div>
    </div>
  );
}
