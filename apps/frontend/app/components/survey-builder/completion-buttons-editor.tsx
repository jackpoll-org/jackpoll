"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Switch } from "@/app/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { useTranslation } from "@/app/i18n/context";
import { newId } from "@/app/components/question-types/helpers";
import {
  MAX_BUTTON_LABEL,
  MAX_BUTTON_URL,
  MAX_COMPLETION_BUTTONS,
  safeButtonUrl,
} from "@/app/lib/survey/completion-buttons";
import type {
  CompletionButton,
  CompletionButtonAction,
  SurveySettings,
} from "@/app/types/survey";

const ACTIONS: CompletionButtonAction[] = ["url", "close", "restart"];

export function CompletionButtonsEditor({
  settings,
  onChange,
}: {
  settings: SurveySettings;
  onChange: (patch: Partial<SurveySettings>) => void;
}) {
  const { t } = useTranslation();
  const buttons = settings.completionButtons ?? [];
  const restartUnavailable =
    !!settings.onePerBrowser || !!settings.requireRespondentToken || !!settings.liveMode;

  function set(next: CompletionButton[]) {
    onChange({ completionButtons: next });
  }
  function patch(id: string, p: Partial<CompletionButton>) {
    set(buttons.map((b) => (b.id === id ? { ...b, ...p } : b)));
  }
  function move(index: number, by: number) {
    const next = [...buttons];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    set(next);
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-0.5">
        <Label>{t("builder.completionButtons.title")}</Label>
        <p className="text-xs text-muted-foreground">{t("builder.completionButtons.help")}</p>
      </div>

      {buttons.map((b, i) => {
        const id = `completion-button-${b.id}`;
        const urlInvalid = !!b.url?.trim() && !safeButtonUrl(b.url);
        return (
          <div key={b.id} className="grid gap-2 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Input
                aria-label={t("builder.completionButtons.label")}
                placeholder={t("builder.completionButtons.label")}
                maxLength={MAX_BUTTON_LABEL}
                value={b.label ?? ""}
                onChange={(e) => patch(b.id, { label: e.target.value })}
              />
              <Button
                variant="ghost"
                size="icon"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                aria-label={t("builder.completionButtons.moveUp")}
              >
                <ChevronUp className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={i === buttons.length - 1}
                onClick={() => move(i, 1)}
                aria-label={t("builder.completionButtons.moveDown")}
              >
                <ChevronDown className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => set(buttons.filter((x) => x.id !== b.id))}
                aria-label={t("builder.completionButtons.remove")}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={b.action}
                onValueChange={(v) => patch(b.id, { action: v as CompletionButtonAction })}
              >
                <SelectTrigger
                  className="w-48"
                  aria-label={t("builder.completionButtons.action")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {t(`builder.completionButtons.action.${a}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch
                  id={`${id}-enabled`}
                  checked={b.enabled}
                  onCheckedChange={(c) => patch(b.id, { enabled: c })}
                />
                <Label htmlFor={`${id}-enabled`} className="font-normal">
                  {t("builder.completionButtons.enabled")}
                </Label>
              </div>
            </div>
            {b.action === "url" && (
              <>
                <Input
                  type="url"
                  aria-label={t("builder.completionButtons.url")}
                  aria-invalid={urlInvalid}
                  placeholder="https://example.com"
                  maxLength={MAX_BUTTON_URL}
                  value={b.url ?? ""}
                  onChange={(e) => patch(b.id, { url: e.target.value })}
                />
                {urlInvalid && (
                  <p className="text-xs text-destructive">
                    {t("builder.completionButtons.urlInvalid")}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Switch
                    id={`${id}-new-tab`}
                    checked={b.newTab ?? false}
                    onCheckedChange={(c) => patch(b.id, { newTab: c })}
                  />
                  <Label htmlFor={`${id}-new-tab`} className="font-normal">
                    {t("builder.completionButtons.newTab")}
                  </Label>
                </div>
              </>
            )}
            {b.action === "close" && (
              <p className="text-xs text-muted-foreground">
                {t("builder.completionButtons.closeHelp")}
              </p>
            )}
            {b.action === "restart" && restartUnavailable && (
              <p className="text-xs text-muted-foreground">
                {t("builder.completionButtons.restartUnavailable")}
              </p>
            )}
          </div>
        );
      })}

      <Button
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={buttons.length >= MAX_COMPLETION_BUTTONS}
        onClick={() =>
          set([...buttons, { id: newId(), label: "", action: "url", enabled: true }])
        }
      >
        <Plus className="size-4" /> {t("builder.completionButtons.add")}
      </Button>

      <div className="flex items-center gap-2">
        <Switch
          id="show-submit-another"
          checked={!settings.hideSubmitAnother}
          onCheckedChange={(c) => onChange({ hideSubmitAnother: !c })}
        />
        <Label htmlFor="show-submit-another" className="font-normal">
          {t("builder.completionButtons.showSubmitAnother")}
        </Label>
      </div>
      {!settings.hideSubmitAnother && (
        <Input
          aria-label={t("builder.completionButtons.submitAnotherLabel")}
          placeholder={t("player.submitAnother")}
          maxLength={MAX_BUTTON_LABEL}
          value={settings.submitAnotherLabel ?? ""}
          onChange={(e) => onChange({ submitAnotherLabel: e.target.value })}
        />
      )}
    </div>
  );
}
