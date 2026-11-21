"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Spinner } from "@/app/components/ui/spinner";
import { usePublicSurvey } from "@/app/hooks/survey";
import { useTranslation } from "@/app/i18n/context";
import { formatAbsolute } from "@/app/lib/survey/format";
import { resolveRunGate, type RunErrorCode, type RunGate as Gate } from "@/app/lib/survey/runs";
import type { Survey } from "@/app/types/survey";
import { SurveyPlayer } from "./survey-player";

interface RunError {
  code: RunErrorCode;
  nextOpensAt?: string;
  survey: Survey;
  runId?: string;
}

interface RunGateProps {
  survey: Survey;
  onRefresh?: () => void;
  runParam?: string | null;
  onPick?: (id: string) => void;
}

export function RunGate({ survey, onRefresh, runParam, onPick }: RunGateProps) {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [runError, setRunError] = useState<RunError | null>(null);
  const reopened =
    !!runError &&
    runError.survey !== survey &&
    survey.run?.status === "open" &&
    survey.run.id === runError.runId;
  if (reopened) setRunError(null);
  const activeError = reopened ? null : runError;
  const gate = gateFor(survey, runParam === undefined ? searchParams.get("run") : runParam, activeError);
  const stale = activeError && activeError.code !== "RUN_REQUIRED" ? activeError : null;

  function pick(id: string) {
    setRunError(null);
    if (onPick) {
      onPick(id);
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("run", id);
    router.replace(`${pathname}?${params.toString()}`);
  }

  if (stale || gate.kind === "play") {
    const played = stale ? stale.survey : survey;
    const runId = stale ? stale.runId : gate.kind === "play" ? gate.runId : undefined;
    return (
      <>
        {stale && (
          <Alert variant="destructive" className="mx-auto mb-4 max-w-xl">
            <AlertDescription>
              {t("runs.player.closedWhileFilling")}
              {stale.nextOpensAt &&
                ` ${t("runs.player.opensOn", { date: formatAbsolute(stale.nextOpensAt, locale) })}`}
            </AlertDescription>
          </Alert>
        )}
        <SurveyPlayer
          survey={played}
          analytics
          runId={runId}
          onRunError={(code, nextOpensAt) => {
            setRunError({ code, nextOpensAt, survey: played, runId });
            onRefresh?.();
          }}
        />
      </>
    );
  }

  if (gate.kind === "pick") {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle className="text-lg">{survey.title || t("player.untitledSurvey")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("runs.player.pick")}</p>
        </CardHeader>
        <CardContent className="grid gap-2">
          {gate.runs.map((r) => (
            <Button key={r.id} variant="outline" className="justify-start" onClick={() => pick(r.id)}>
              {r.label}
            </Button>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-xl text-center">
      <CardContent className="py-12 text-sm text-muted-foreground">
        {gate.opensAt
          ? t("runs.player.opensOn", { date: formatAbsolute(gate.opensAt, locale) })
          : t("runs.player.notOpen")}
      </CardContent>
    </Card>
  );
}

export function AccessCodeRunGate({ survey: resolved }: { survey: Survey }) {
  const [runId, setRunId] = useState(resolved.run?.id);
  const query = usePublicSurvey(resolved.hasRuns ? resolved.id : undefined, runId);
  const survey = query.data ?? (runId === resolved.run?.id ? resolved : undefined);
  if (!survey) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="size-6" />
      </div>
    );
  }
  return (
    <RunGate
      survey={survey}
      runParam={runId ?? null}
      onPick={setRunId}
      onRefresh={() => void query.refetch()}
    />
  );
}

function gateFor(survey: Survey, runParam: string | null, runError: RunError | null): Gate {
  if (runError?.code === "RUN_REQUIRED") {
    const open = (survey.runs ?? []).filter((r) => r.status === "open");
    return open.length > 0
      ? { kind: "pick", runs: open }
      : resolveRunGate(survey.runs, null, survey.hasRuns);
  }
  const gate = resolveRunGate(survey.runs, runParam, survey.hasRuns);
  if (gate.kind === "play" && gate.runId && survey.run?.id !== gate.runId) {
    return { kind: "notOpen" };
  }
  return gate;
}
