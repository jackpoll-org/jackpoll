"use client";

import { useState } from "react";
import { KeyRound, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Spinner } from "@/app/components/ui/spinner";
import { SurveyPlayer } from "@/app/components/survey-player/survey-player";
import { useResolveAccessCode } from "@/app/hooks/survey";
import { useTranslation } from "@/app/i18n/context";
import type { Survey } from "@/app/types/survey";

/**
 * Dashboard entry point for "join by code" (issue #15). Renders as a dialog
 * (rather than navigating to /join) so there's always an obvious way back to
 * the dashboard — closing the dialog, or a back button once a survey has
 * resolved, instead of being stuck on a standalone page (#).
 */
export function JoinByCodeDialog() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const resolve = useResolveAccessCode();

  function reset() {
    setCode("");
    setError(null);
    setSurvey(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <KeyRound className="size-4" />
          {t("dashboard.joinByCode")}
        </Button>
      </DialogTrigger>
      <DialogContent
        className={survey ? "max-w-2xl" : "sm:max-w-sm"}
        showCloseButton={!survey}
      >
        {survey ? (
          <div className="grid gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={reset}
            >
              <ArrowLeft className="size-4" />
              {t("common.back")}
            </Button>
            <SurveyPlayer survey={survey} analytics />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("join.title")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dashboard-join-code">{t("join.label")}</Label>
                <Input
                  id="dashboard-join-code"
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
