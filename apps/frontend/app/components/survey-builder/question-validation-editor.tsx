"use client";

import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import type {
  Question,
  ValidationRule,
  ValidationRuleType,
} from "@/app/types/survey";
import {
  getValidationRules,
  rulesForType,
  withValidationRules,
} from "@/app/lib/survey/validation";
import { useTranslation } from "@/app/i18n/context";
import type { TranslationKey } from "@/app/i18n/translations";

interface QuestionValidationEditorProps {
  question: Question;
  onChange: (patch: Partial<Question>) => void;
}

const NUMERIC_LABEL_KEY: Partial<Record<ValidationRuleType, TranslationKey>> = {
  minLength: "qvalid.minLength",
  maxLength: "qvalid.maxLength",
  minSelected: "qvalid.minSelected",
  maxSelected: "qvalid.maxSelected",
};

/** Common patterns respondents ask for most often, so authors rarely need to
 *  hand-write a regex (issue #). "custom" leaves the field as free text. */
const PATTERN_PRESETS: { id: string; pattern: string; labelKey: TranslationKey }[] = [
  { id: "email", pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", labelKey: "qvalid.preset.email" },
  { id: "phone", pattern: "^\\+?[0-9\\s\\-()]{7,}$", labelKey: "qvalid.preset.phone" },
  { id: "url", pattern: "^https?:\\/\\/.+$", labelKey: "qvalid.preset.url" },
  { id: "numbersOnly", pattern: "^[0-9]+$", labelKey: "qvalid.preset.numbersOnly" },
  { id: "lettersOnly", pattern: "^[A-Za-z]+$", labelKey: "qvalid.preset.lettersOnly" },
];

function presetForPattern(pattern: string): string {
  return PATTERN_PRESETS.find((p) => p.pattern === pattern)?.id ?? "custom";
}

function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

/** Builder section to configure answer-validation rules for a question (#4). */
export function QuestionValidationEditor({
  question,
  onChange,
}: QuestionValidationEditorProps) {
  const { t } = useTranslation();
  const applicable = rulesForType(question.type);
  if (applicable.length === 0) return null;

  const rules = getValidationRules(question);
  const byType = new Map(rules.map((r) => [r.type, r] as const));

  function commit(next: ValidationRule[]) {
    onChange({ settings: withValidationRules(question, next) });
  }

  function upsertNumeric(type: ValidationRuleType, raw: string) {
    const others = rules.filter((r) => r.type !== type);
    if (raw === "") {
      commit(others);
      return;
    }
    const value = Number(raw);
    if (Number.isNaN(value) || value < 0) return;
    commit([...others, { type, value }]);
  }

  function upsertPattern(raw: string) {
    const others = rules.filter((r) => r.type !== "pattern");
    commit(raw.trim() === "" ? others : [...others, { type: "pattern", pattern: raw }]);
  }

  return (
    <div className="grid gap-3 rounded-lg border border-dashed p-3">
      <span className="text-sm font-medium">{t("qvalid.title")}</span>

      <div className="flex flex-wrap gap-3">
        {applicable.flatMap((type) =>
          type === "pattern"
            ? []
            : [
                <div key={type} className="grid gap-1">
                  <Label htmlFor={`${question.id}-${type}`} className="text-xs">
                    {(() => {
                      const k = NUMERIC_LABEL_KEY[type];
                      return k ? t(k) : type;
                    })()}
                  </Label>
                  <Input
                    id={`${question.id}-${type}`}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    className="w-32"
                    value={byType.get(type)?.value ?? ""}
                    onChange={(e) => upsertNumeric(type, e.target.value)}
                  />
                </div>,
              ],
        )}
      </div>

      {applicable.includes("pattern") && (() => {
        const pattern = byType.get("pattern")?.pattern ?? "";
        const preset = presetForPattern(pattern);
        const invalid = pattern.trim() !== "" && !isValidRegex(pattern);
        return (
          <div className="grid gap-1">
            <Label htmlFor={`${question.id}-pattern`} className="text-xs">
              {t("qvalid.patternLabel")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("qvalid.patternHelp")}
            </p>
            <Select
              value={preset}
              onValueChange={(v) => {
                if (v === "custom") return;
                const found = PATTERN_PRESETS.find((p) => p.id === v);
                if (found) upsertPattern(found.pattern);
              }}
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">{t("qvalid.preset.custom")}</SelectItem>
                {PATTERN_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {t(p.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              id={`${question.id}-pattern`}
              placeholder={t("qvalid.patternPlaceholder")}
              value={pattern}
              onChange={(e) => upsertPattern(e.target.value)}
              aria-invalid={invalid}
            />
            {invalid && (
              <p className="text-xs text-destructive">{t("qvalid.patternInvalid")}</p>
            )}
          </div>
        );
      })()}
    </div>
  );
}
