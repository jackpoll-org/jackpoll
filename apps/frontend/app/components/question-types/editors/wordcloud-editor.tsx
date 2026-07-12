"use client";

import { Switch } from "@/app/components/ui/switch";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import type { QuestionEditorProps } from "../types";
import { useTranslation } from "@/app/i18n/context";

/** Read the wordcloud config from a question's settings, with defaults. */
export function wordcloudConfig(
  settings: Record<string, unknown> | null | undefined,
) {
  const raw = Number(settings?.maxWords);
  // Cap respondents at a sane range so one person can't flood the cloud.
  const maxWords = Number.isFinite(raw) && raw >= 1 ? Math.min(raw, 10) : 3;
  // Profanity filtering defaults on; only an explicit false disables it.
  const filterProfanity = settings?.filterProfanity !== false;
  return { maxWords, filterProfanity };
}

/** Editor for wordcloud questions: how many words each respondent may submit. */
export function WordcloudEditor({ question, onChange }: QuestionEditorProps) {
  const { t } = useTranslation();
  const cfg = wordcloudConfig(question.settings);

  function patch(p: Record<string, unknown>) {
    onChange({ settings: { ...(question.settings ?? {}), ...p } });
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">{t("qedit.wordcloud.help")}</p>

      <div className="grid gap-1 sm:max-w-[12rem]">
        <Label htmlFor={`${question.id}-maxwords`} className="text-xs">
          {t("qedit.wordcloud.maxWords")}
        </Label>
        <Input
          id={`${question.id}-maxwords`}
          type="number"
          min={1}
          max={10}
          value={cfg.maxWords}
          onChange={(e) =>
            patch({ maxWords: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })
          }
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id={`${question.id}-profanity`}
          checked={cfg.filterProfanity}
          onCheckedChange={(c) => patch({ filterProfanity: c })}
        />
        <Label htmlFor={`${question.id}-profanity`} className="font-normal">
          {t("qedit.wordcloud.filterProfanity")}
        </Label>
      </div>
    </div>
  );
}
