"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { LanguageSwitcher } from "@/app/components/common/language-switcher";
import { RespondentThemeToggle } from "@/app/components/survey-player/respondent-theme-toggle";
import { StudentResultView } from "@/app/components/survey-player/student-result";
import { useStudentResult } from "@/app/hooks/survey";
import { useTranslation } from "@/app/i18n/context";

export default function StudentResultPage() {
  const params = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const lookup = useStudentResult(params.id);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim()) lookup.mutate(code.trim());
  }

  return (
    <div className="min-h-svh bg-background px-4 py-8">
      <div className="mx-auto grid w-full max-w-2xl gap-4">
        <div className="flex justify-end gap-1">
          <RespondentThemeToggle />
          <LanguageSwitcher withIcon />
        </div>
        {lookup.data ? (
          <StudentResultView result={lookup.data} />
        ) : (
          <Card className="mx-auto w-full max-w-md">
            <CardHeader>
              <CardTitle>{t("studentResult.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3" onSubmit={handleSubmit}>
                <Label htmlFor="result-code">{t("studentResult.codeLabel")}</Label>
                <Input
                  id="result-code"
                  autoComplete="off"
                  autoCapitalize="characters"
                  maxLength={32}
                  className="font-mono uppercase tracking-widest"
                  placeholder="ABC-DEF"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                {lookup.isError && (
                  <p className="text-sm text-destructive">
                    {lookup.error instanceof Error ? lookup.error.message : t("studentResult.notFound")}
                  </p>
                )}
                <Button type="submit" disabled={lookup.isPending || !code.trim()}>
                  {t("studentResult.show")}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
