"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Label } from "@/app/components/ui/label";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { Switch } from "@/app/components/ui/switch";
import { Badge } from "@/app/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { useBuilder } from "./builder-context";
import { useTranslation, type TranslateFn } from "@/app/i18n/context";
import { LOCALES, LOCALE_LABELS, DEFAULT_LOCALE } from "@/app/i18n/translations";
import {
  fieldKeys,
  defaultLanguageOf,
  getTranslation,
} from "@/app/lib/survey/content-i18n";
import type { Survey } from "@/app/types/survey";

interface Field {
  key: string;
  canonical: string;
  label: string;
  multiline?: boolean;
}

/** Flatten every translatable field of the survey, in display order. */
function collectFields(survey: Survey, t: TranslateFn): Field[] {
  const fields: Field[] = [];
  const push = (key: string, canonical: string | undefined, label: string, multiline?: boolean) => {
    if (canonical && canonical.trim()) fields.push({ key, canonical, label, multiline });
  };

  push(fieldKeys.surveyTitle, survey.title, t("builder.i18n.field.surveyTitle"));
  push(fieldKeys.surveyDescription, survey.description, t("builder.i18n.field.surveyDescription"), true);
  push(
    fieldKeys.confirmationMessage,
    survey.settings.confirmationMessage,
    t("builder.i18n.field.confirmationMessage"),
    true,
  );

  for (const s of survey.sections ?? []) {
    push(fieldKeys.sectionTitle(s.id), s.title, t("builder.i18n.field.page", { title: s.title ?? "" }));
    push(fieldKeys.sectionDescription(s.id), s.description, t("builder.i18n.field.pageDescription"), true);
  }

  survey.questions.forEach((q, i) => {
    const n = String(i + 1);
    push(
      fieldKeys.questionTitle(q.id),
      q.title,
      t("builder.i18n.field.question", {
        n,
        title: q.title || t("builder.i18n.field.questionUntitled"),
      }),
    );
    push(fieldKeys.questionDescription(q.id), q.description, t("builder.i18n.field.questionDescription", { n }), true);
    for (const o of q.options ?? []) push(fieldKeys.optionLabel(o.id), o.label, t("builder.i18n.field.option", { n, label: o.label }));
    for (const o of q.rows ?? []) push(fieldKeys.optionLabel(o.id), o.label, t("builder.i18n.field.row", { n, label: o.label }));
    for (const o of q.columns ?? []) push(fieldKeys.optionLabel(o.id), o.label, t("builder.i18n.field.column", { n, label: o.label }));
  });

  return fields;
}

/**
 * Builder panel to enable multiple languages and author per-language
 * translations of the survey content (issue #37). Untranslated fields are
 * flagged but never block — the player falls back to the default language.
 */
export function TranslationsCard() {
  const { t } = useTranslation();
  const { survey, setLanguages, setTranslation } = useBuilder();
  const languages = survey.languages ?? [];
  const defaultLang = defaultLanguageOf(survey);
  const others = languages.filter((l) => l !== defaultLang);
  const [editing, setEditing] = useState<string>(others[0] ?? "");
  const editLang = others.includes(editing) ? editing : others[0] ?? "";

  function toggleLanguage(locale: string, on: boolean) {
    const next = on
      ? [...languages, locale]
      : languages.filter((l) => l !== locale);
    let def = survey.defaultLanguage ?? DEFAULT_LOCALE;
    if (!next.includes(def)) def = next[0] ?? DEFAULT_LOCALE;
    setLanguages(next, def);
  }

  const fields = collectFields(survey, t);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("builder.i18n.title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-xs text-muted-foreground">
          {t("builder.i18n.help")}
        </p>

        <div className="grid gap-2">
          <Label>{t("builder.i18n.enabled")}</Label>
          {LOCALES.map((locale) => (
            <div key={locale} className="flex items-center justify-between gap-4">
              <span className="text-sm">{LOCALE_LABELS[locale]}</span>
              <Switch
                checked={languages.includes(locale)}
                onCheckedChange={(c) => toggleLanguage(locale, c)}
              />
            </div>
          ))}
        </div>

        {languages.length > 1 && (
          <div className="grid gap-2">
            <Label htmlFor="default-language">{t("builder.i18n.default")}</Label>
            <Select
              value={survey.defaultLanguage ?? ""}
              onValueChange={(v) => setLanguages(languages, v)}
            >
              <SelectTrigger id="default-language" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map((l) => (
                  <SelectItem key={l} value={l}>
                    {LOCALE_LABELS[l as keyof typeof LOCALE_LABELS] ?? l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("builder.i18n.defaultHelp")}
            </p>
          </div>
        )}

        {others.length > 0 && (
          <div className="grid gap-3 border-t pt-4">
            <div className="grid gap-2">
              <Label htmlFor="editing-language">{t("builder.i18n.translateInto")}</Label>
              <Select value={editLang} onValueChange={setEditing}>
                <SelectTrigger id="editing-language" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {others.map((l) => (
                    <SelectItem key={l} value={l}>
                      {LOCALE_LABELS[l as keyof typeof LOCALE_LABELS] ?? l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {fields.map((field) => {
              const value = getTranslation(survey, editLang, field.key) ?? "";
              const missing = !value.trim();
              return (
                <div key={field.key} className="grid gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs">{field.label}</Label>
                    {missing && (
                      <Badge variant="outline" className="text-amber-600">
                        {t("builder.i18n.missing")}
                      </Badge>
                    )}
                  </div>
                  {field.multiline ? (
                    <Textarea
                      value={value}
                      placeholder={field.canonical}
                      onChange={(e) => setTranslation(editLang, field.key, e.target.value)}
                    />
                  ) : (
                    <Input
                      value={value}
                      placeholder={field.canonical}
                      onChange={(e) => setTranslation(editLang, field.key, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
