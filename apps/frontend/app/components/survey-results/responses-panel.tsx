"use client";

import { useState } from "react";
import { Eye, FileDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { downloadResponsePdfApi } from "@/app/lib/survey/api";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Badge } from "@/app/components/ui/badge";
import { Skeleton } from "@/app/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/app/components/ui/alert-dialog";
import { useClearResponses, useDeleteResponse, useResponses } from "@/app/hooks/survey";
import { formatAnswer } from "@/app/lib/survey/export";
import { useTranslation } from "@/app/i18n/context";
import type { Survey, SurveyResponseDto } from "@/app/types/survey";

type PassFilter = "all" | "passed" | "failed";

export function ResponsesPanel({ survey }: { survey: Survey }) {
  const { t } = useTranslation();
  const responses = useResponses(survey.id);
  const deleteResponse = useDeleteResponse(survey.id);
  const clearResponses = useClearResponses(survey.id);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pass, setPass] = useState<PassFilter>("all");
  const [selected, setSelected] = useState<SurveyResponseDto | null>(null);

  if (responses.isLoading) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  const all = responses.data ?? [];
  const filtered = all.filter((r) => {
    const t = new Date(r.submittedAt).getTime();
    if (from && t < new Date(from).getTime()) return false;
    if (to && t > new Date(`${to}T23:59:59`).getTime()) return false;
    if (pass === "passed" && r.passed !== true) return false;
    if (pass === "failed" && r.passed !== false) return false;
    return true;
  });

  async function remove(id: string) {
    try {
      await deleteResponse.mutateAsync(id);
      toast.success(t("results.responses.deleted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("results.responses.deleteFailed"));
    }
  }

  async function downloadPdf(id: string) {
    try {
      const blob = await downloadResponsePdfApi(survey.id, id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `response-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("results.export.pdfFailed"));
    }
  }

  async function clearAll() {
    try {
      await clearResponses.mutateAsync();
      toast.success(t("results.responses.cleared"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("results.responses.clearFailed"));
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1">
            <Label htmlFor="from" className="text-xs">{t("results.responses.from")}</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="to" className="text-xs">{t("results.responses.to")}</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {survey.settings.isQuiz && (
            <div className="grid gap-1">
              <Label className="text-xs">{t("results.responses.result")}</Label>
              <Select value={pass} onValueChange={(v) => setPass(v as PassFilter)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("results.responses.all")}</SelectItem>
                  <SelectItem value="passed">{t("results.responses.passed")}</SelectItem>
                  <SelectItem value="failed">{t("results.responses.failed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {all.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive">
                <Trash2 className="size-4" />
                {t("results.responses.clearAll")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("results.responses.clearTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("results.responses.clearBody", { count: String(all.length) })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={clearAll}>
                  {t("results.responses.clearConfirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("results.responses.noMatch")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("results.responses.colSubmitted")}</TableHead>
                {survey.settings.requireRespondentName && (
                  <TableHead>{t("results.responses.colName")}</TableHead>
                )}
                <TableHead>{t("results.responses.colDuration")}</TableHead>
                {survey.settings.isQuiz && <TableHead>{t("results.responses.colScore")}</TableHead>}
                <TableHead className="text-right">{t("results.responses.colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.submittedAt).toLocaleString()}</TableCell>
                  {survey.settings.requireRespondentName && (
                    <TableCell className="font-medium">{r.respondentName || "—"}</TableCell>
                  )}
                  <TableCell>
                    {r.durationMs != null ? `${Math.round(r.durationMs / 1000)}s` : "—"}
                  </TableCell>
                  {survey.settings.isQuiz && (
                    <TableCell>
                      {r.score != null ? (
                        <span className="flex items-center gap-2">
                          {r.score}/{r.maxScore}
                          {r.passed != null && (
                            <Badge variant={r.passed ? "default" : "destructive"}>
                              {r.passed ? t("results.responses.pass") : t("results.responses.fail")}
                            </Badge>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("results.responses.view")}
                      onClick={() => setSelected(r)}
                    >
                      <Eye className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("results.responses.downloadPdf")}
                      onClick={() => downloadPdf(r.id)}
                    >
                      <FileDown className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("results.responses.delete")}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => remove(r.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("results.responses.details")}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="grid gap-3">
              {survey.questions.map((q) => {
                const answer = selected.answers.find((a) => a.questionId === q.id);
                return (
                  <div key={q.id} className="grid gap-0.5">
                    <span className="text-sm font-medium">
                      {q.title || t("results.untitledQuestion")}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {answer ? formatAnswer(q, answer.value) || "—" : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
