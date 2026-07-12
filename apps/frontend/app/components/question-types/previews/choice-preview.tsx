"use client";

import { Checkbox } from "@/app/components/ui/checkbox";
import { Label } from "@/app/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import type { Option } from "@/app/types/survey";
import type { QuestionPreviewProps } from "../types";
import { useTranslation } from "@/app/i18n/context";

function EmptyHint() {
  const { t } = useTranslation();
  return <p className="text-sm text-muted-foreground italic">{t("qprev.choice.empty")}</p>;
}

/** Preview / answer renderer for multiple-choice, checkboxes and dropdown. */
export function ChoicePreview({
  question,
  value,
  onChange,
  disabled,
  disabledOptionIds,
}: QuestionPreviewProps) {
  const { t } = useTranslation();
  const options: Option[] = question.options ?? [];
  if (options.length === 0) {
    return <EmptyHint />;
  }

  const interactive = !!onChange;
  const isDisabled = disabled ?? !interactive;
  const fullIds = new Set(disabledOptionIds ?? []);

  if (question.type === "dropdown") {
    const selected = typeof value === "string" ? value : undefined;
    return (
      <Select
        disabled={isDisabled}
        value={selected}
        onValueChange={interactive ? (v) => onChange(v) : undefined}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t("qprev.choice.choose")} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id} disabled={fullIds.has(o.id)}>
              {o.label}
              {fullIds.has(o.id) && t("qprev.choice.fullSuffix")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (question.type === "checkboxes") {
    const selected: string[] = Array.isArray(value) ? (value as string[]) : [];
    function toggle(id: string, checked: boolean) {
      if (!onChange) return;
      onChange(checked ? [...selected, id] : selected.filter((s) => s !== id));
    }
    return (
      <div className="grid gap-2">
        {options.map((o) => (
          <div key={o.id} className="flex items-center gap-2">
            <Checkbox
              id={`${question.id}-${o.id}`}
              disabled={isDisabled}
              checked={selected.includes(o.id)}
              onCheckedChange={
                interactive ? (c) => toggle(o.id, c === true) : undefined
              }
            />
            <Label htmlFor={`${question.id}-${o.id}`} className="font-normal">
              {o.label}
            </Label>
          </div>
        ))}
      </div>
    );
  }

  // multiple-choice — default to "" so the group stays controlled (avoids a
  // React uncontrolled→controlled warning when the first option is picked).
  const selected = typeof value === "string" ? value : "";
  return (
    <RadioGroup
      disabled={isDisabled}
      value={selected}
      onValueChange={interactive ? (v) => onChange(v) : undefined}
      className="grid gap-2"
    >
      {options.map((o) => {
        const full = fullIds.has(o.id);
        return (
          <div key={o.id} className="flex items-center gap-2">
            <RadioGroupItem
              value={o.id}
              id={`${question.id}-${o.id}`}
              disabled={full}
            />
            <Label
              htmlFor={`${question.id}-${o.id}`}
              className={full ? "font-normal text-muted-foreground" : "font-normal"}
            >
              {o.label}
              {full && t("qprev.choice.fullSuffix")}
            </Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}
