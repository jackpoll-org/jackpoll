"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  Inbox,
  Play,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Spinner } from "@/app/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { useState } from "react";
import {
  useDeletePreviewResponses,
  useResponses,
  useSurvey,
  useSurveyResults,
} from "@/app/hooks/survey";
import { useLiveResultsSocket } from "@/app/hooks/results-live";
import { Switch } from "@/app/components/ui/switch";
import { Label } from "@/app/components/ui/label";
import { buildResponsesCsv, downloadText } from "@/app/lib/survey/export";
import { downloadXlsxApi } from "@/app/lib/survey/api";
import { exportResultsPdf } from "@/app/lib/survey/pdf-export";
import type { QuizStats } from "@/app/types/survey";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { QuestionResultCard, type ChartType } from "./question-result-card";
import { ChartColorsDialog } from "./chart-colors-dialog";
import { ResultBarChart } from "./result-charts";
import { ResponsesPanel } from "./responses-panel";
import { AnalyticsPanel } from "./analytics-panel";
import { StatTile } from "./stat-tile";
import {
  formatAbsolute,
  formatDuration,
  formatRelative,
} from "@/app/lib/survey/format";
import { useTranslation } from "@/app/i18n/context";

function QuizAnalytics({ quiz }: { quiz: QuizStats }) {
  const { t } = useTranslation();
  const total = quiz.passedCount + quiz.failedCount;
  const passRate = total > 0 ? Math.round((quiz.passedCount / total) * 100) : 0;
  const distribution = quiz.distribution.map((d) => ({
    label: String(d.score),
    count: d.count,
  }));

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base">{t("results.quiz.title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile
            label={t("results.quiz.avgScore")}
            value={`${quiz.averageScore.toFixed(1)} / ${quiz.maxScore}`}
          />
          <StatTile
            label={t("results.quiz.passRate")}
            value={quiz.passingScore != null ? `${passRate}%` : "—"}
          />
          <StatTile
            label={t("results.quiz.passedFailed")}
            value={`${quiz.passedCount} / ${quiz.failedCount}`}
          />
        </div>
        {distribution.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">{t("results.quiz.distribution")}</p>
            <ResultBarChart data={distribution} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ResultsDashboard({ surveyId }: { surveyId: string }) {
  const { t, locale } = useTranslation();
  const survey = useSurvey(surveyId);
  const [showPreview, setShowPreview] = useState(false);
  const results = useSurveyResults(surveyId, showPreview);
  const responses = useResponses(surveyId);
  const deletePreview = useDeletePreviewResponses(surveyId);
  const [exporting, setExporting] = useState(false);
  // Mirrors each question's on-screen chart-type selection so the PDF export
  // matches what's currently displayed instead of always drawing bars (#).
  const [chartTypes, setChartTypes] = useState<Record<string, ChartType>>({});

  async function handleDeletePreview() {
    try {
      const n = await deletePreview.mutateAsync();
      toast.success(t("results.preview.deleted", { count: String(n) }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("results.preview.deleteFailed"));
    }
  }

  // Live push so wordcloud / presentation results update in near-real-time
  // (falls back to polling when disabled or unavailable).
  useLiveResultsSocket(surveyId);

  const questionById = new Map(
    (survey.data?.questions ?? []).map((q) => [q.id, q]),
  );

  // Preview-aware mean completion time, computed authoritatively by the backend
  // so it stays consistent with the totalResponses/lastResponseAt KPIs.
  const avgDurationMs = results.data?.avgDurationMs ?? null;

  function exportCsv() {
    if (!survey.data || !responses.data) return;
    downloadText(
      `${survey.data.title || "survey"}-responses.csv`,
      buildResponsesCsv(survey.data, responses.data),
      "text/csv;charset=utf-8",
    );
  }

  function exportJson() {
    if (!responses.data) return;
    downloadText(
      `${survey.data?.title || "survey"}-responses.json`,
      JSON.stringify(responses.data, null, 2),
      "application/json",
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  async function exportExcel() {
    const title = survey.data?.title || "survey";
    setExporting(true);
    const toastId = toast.loading(t("results.export.excelGenerating"));
    try {
      const blob = await downloadXlsxApi(surveyId);
      downloadBlob(`${title}-responses-${today}.xlsx`, blob);
      toast.success(t("results.export.excelReady"), { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("results.export.excelFailed"), {
        id: toastId,
      });
    } finally {
      setExporting(false);
    }
  }

  async function exportPdf() {
    if (!survey.data || !results.data) return;
    setExporting(true);
    const toastId = toast.loading(t("results.export.pdfGenerating"));
    try {
      await exportResultsPdf({
        survey: survey.data,
        results: results.data,
        avgDurationMs,
        chartTypes,
      });
      toast.success(t("results.export.pdfReady"), { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("results.export.pdfFailed"), {
        id: toastId,
      });
    } finally {
      setExporting(false);
    }
  }

  function refresh() {
    results.refetch();
    responses.refetch();
    toast.success(t("results.refreshed"));
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={`/surveys/${surveyId}/edit`}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {t("results.back")}
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {survey.data?.title ?? t("results.title")}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Switch
              id="show-preview"
              checked={showPreview}
              onCheckedChange={setShowPreview}
            />
            <Label htmlFor="show-preview" className="text-sm font-normal text-muted-foreground">
              {t("results.preview.show")}
            </Label>
          </div>
          {showPreview && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeletePreview}
              disabled={deletePreview.isPending}
            >
              {deletePreview.isPending ? (
                <Spinner className="size-4" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {t("results.preview.delete")}
            </Button>
          )}
          {survey.data?.settings.liveMode && (
            <Button asChild size="sm">
              <Link href={`/surveys/${surveyId}/present`}>
                <Play className="size-4" />
                {t("live.present")}
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="size-4" />
            {t("results.refresh")}
          </Button>
          {survey.data && <ChartColorsDialog survey={survey.data} />}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" disabled={!responses.data?.length || exporting}>
                <Download className="size-4" />
                {t("results.export")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={exportCsv}>CSV</DropdownMenuItem>
              <DropdownMenuItem onSelect={exportJson}>JSON</DropdownMenuItem>
              <DropdownMenuItem onSelect={exportExcel}>Excel</DropdownMenuItem>
              <DropdownMenuItem onSelect={exportPdf}>PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {results.isLoading ? (
        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : results.isError ? (
        <p className="text-sm text-destructive">
          {results.error instanceof Error
            ? results.error.message
            : t("results.loadFailed")}
        </p>
      ) : (
        <Tabs defaultValue="overview">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">{t("results.tab.overview")}</TabsTrigger>
            <TabsTrigger value="responses">{t("results.tab.responses")}</TabsTrigger>
            <TabsTrigger value="analytics">{t("results.tab.analytics")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile
              label={t("results.kpi.total")}
              value={
                survey.data?.settings.responseLimit
                  ? `${results.data?.totalResponses ?? 0} / ${survey.data.settings.responseLimit}`
                  : String(results.data?.totalResponses ?? 0)
              }
              icon={<Users className="size-5" />}
            />
            <StatTile
              label={t("results.kpi.last")}
              value={formatRelative(results.data?.lastResponseAt, locale)}
              valueTitle={
                results.data?.lastResponseAt
                  ? formatAbsolute(results.data.lastResponseAt, locale)
                  : undefined
              }
              icon={<Calendar className="size-5" />}
            />
            <StatTile
              label={t("results.kpi.avgTime")}
              value={formatDuration(avgDurationMs)}
              icon={<Clock className="size-5" />}
            />
          </div>

          {results.data?.quiz && (
            <QuizAnalytics quiz={results.data.quiz} />
          )}

          {(results.data?.totalResponses ?? 0) === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Inbox className="size-6" />
                </span>
                <p className="text-sm text-muted-foreground">{t("results.empty")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {results.data?.questions.map((result) => (
                <QuestionResultCard
                  key={result.questionId}
                  result={result}
                  question={questionById.get(result.questionId)}
                  colors={survey.data?.settings.colorPalette}
                  onChartTypeChange={(id, t) =>
                    setChartTypes((prev) =>
                      prev[id] === t ? prev : { ...prev, [id]: t },
                    )
                  }
                />
              ))}
            </div>
          )}
          </TabsContent>

          <TabsContent value="responses">
            {survey.data ? (
              <ResponsesPanel survey={survey.data} />
            ) : (
              <Skeleton className="h-64 rounded-xl" />
            )}
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsPanel surveyId={surveyId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
