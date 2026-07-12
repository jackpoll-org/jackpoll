"use client";

import { useEffect, useState } from "react";
import { SurveyPlayer } from "@/app/components/survey-player/survey-player";
import { useResolveAccessCode } from "@/app/hooks/survey";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Spinner } from "@/app/components/ui/spinner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { LanguageSwitcher } from "@/app/components/common/language-switcher";
import { RespondentThemeToggle } from "@/app/components/survey-player/respondent-theme-toggle";
import { surveyBackgroundStyle } from "@/app/components/survey-player/branding-frame";
import { useTranslation } from "@/app/i18n/context";
import type { Survey } from "@/app/types/survey";

/** Public entry page: enter an access code to open a survey (issue #15). */
export default function JoinPage() {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const resolve = useResolveAccessCode();

  // A `?code=` (e.g. from the lobby QR) prefills and opens the survey directly.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("code");
    if (!c) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCode(c.toUpperCase());
    resolve
      .mutateAsync(c.trim())
      .then(setSurvey)
      .catch(() => setError(t("join.notFound")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!code.trim()) return;
    try {
      const result = await resolve.mutateAsync(code.trim());
      setSurvey(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("join.notFound"));
    }
  }

  if (survey) {
    return (
      <div className="min-h-svh bg-background px-4 py-8" style={surveyBackgroundStyle(survey)}>
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-4 flex justify-end gap-1">
            <RespondentThemeToggle />
            <LanguageSwitcher withIcon />
          </div>
          <SurveyPlayer survey={survey} analytics />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>{t("join.title")}</CardTitle>
          <LanguageSwitcher />
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="code">{t("join.label")}</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABCD2345"
                autoComplete="off"
                autoFocus
                className="text-center font-mono text-lg tracking-widest"
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <Button type="submit" disabled={resolve.isPending || !code.trim()}>
              {resolve.isPending && <Spinner className="size-4" />}
              {t("join.open")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
