// ── Results PDF export (issue #32) ──────────────────────────────────
//
// Builds a printable PDF of the results dashboard (KPI cards, per-question
// charts, quiz analytics) using jsPDF, lazy-loaded so it stays out of the main
// bundle. Charts are drawn as deterministic bars with a fixed, light-background
// palette so they render identically regardless of the app's dark mode.

import { labelMap } from "./export";
import { groupTextAnswers } from "./results";
import type {
  QuestionResult,
  Survey,
  SurveyResults,
} from "@/app/types/survey";

/** Fixed RGB palette — independent of the theme so PDFs are dark-mode-safe. */
const BAR_COLOR: [number, number, number] = [37, 99, 235]; // blue-600
const TEXT_COLOR: [number, number, number] = [17, 24, 39]; // gray-900
const MUTED_COLOR: [number, number, number] = [107, 114, 128]; // gray-500
const TRACK_COLOR: [number, number, number] = [229, 231, 235]; // gray-200

const MARGIN = 40;
const PAGE_W = 595; // A4 portrait, pt
const PAGE_H = 842;
const CONTENT_W = PAGE_W - MARGIN * 2;

export interface PdfExportData {
  survey: Survey;
  results: SurveyResults;
  /** Average completion time in ms, or null. */
  avgDurationMs: number | null;
}

/** Generate and download a results PDF. */
export async function exportResultsPdf(data: PdfExportData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const ctx = { doc, y: MARGIN };

  drawTitle(ctx, data);
  drawKpis(ctx, data);
  if (data.results.quiz) drawQuiz(ctx, data.results.quiz);
  for (const q of data.results.questions) {
    drawQuestion(ctx, data.survey, q);
  }

  doc.save(buildFilename(data.survey.title));
}

interface Ctx {
  doc: import("jspdf").jsPDF;
  y: number;
}

function ensureSpace(ctx: Ctx, needed: number): void {
  if (ctx.y + needed > PAGE_H - MARGIN) {
    ctx.doc.addPage();
    ctx.y = MARGIN;
  }
}

function drawTitle(ctx: Ctx, data: PdfExportData): void {
  const { doc } = ctx;
  doc.setTextColor(...TEXT_COLOR);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(data.survey.title || "Survey results", MARGIN, ctx.y + 6);
  ctx.y += 22;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED_COLOR);
  doc.text(
    `Exported ${new Date().toLocaleString()}`,
    MARGIN,
    ctx.y,
  );
  ctx.y += 24;
}

function drawKpis(ctx: Ctx, data: PdfExportData): void {
  const last = data.results.lastResponseAt
    ? new Date(data.results.lastResponseAt).toLocaleString()
    : "—";
  const avg =
    data.avgDurationMs != null
      ? `${Math.round(data.avgDurationMs / 1000)}s`
      : "—";

  drawKpiRow(ctx, [
    ["Total responses", String(data.results.totalResponses)],
    ["Last response", last],
    ["Avg. completion", avg],
  ]);
}

function drawKpiRow(ctx: Ctx, kpis: [string, string][]): void {
  const { doc } = ctx;
  ensureSpace(ctx, 56);
  const gap = 12;
  const w = (CONTENT_W - gap * (kpis.length - 1)) / kpis.length;
  kpis.forEach(([label, value], i) => {
    const x = MARGIN + i * (w + gap);
    doc.setDrawColor(...TRACK_COLOR);
    doc.setFillColor(250, 250, 251);
    doc.roundedRect(x, ctx.y, w, 48, 4, 4, "FD");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_COLOR);
    doc.text(label.toUpperCase(), x + 10, ctx.y + 16);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_COLOR);
    doc.text(value, x + 10, ctx.y + 36);
    doc.setFont("helvetica", "normal");
  });
  ctx.y += 48 + 20;
}

function drawQuiz(ctx: Ctx, quiz: SurveyResults["quiz"]): void {
  if (!quiz) return;
  const total = quiz.passedCount + quiz.failedCount;
  const passRate =
    quiz.passingScore != null && total > 0
      ? `${Math.round((quiz.passedCount / total) * 100)}%`
      : "—";

  drawSectionHeading(ctx, "Quiz analytics");
  drawKpiRow(ctx, [
    ["Average score", `${quiz.averageScore.toFixed(1)} / ${quiz.maxScore}`],
    ["Pass rate", passRate],
    ["Passed / failed", `${quiz.passedCount} / ${quiz.failedCount}`],
  ]);

  const bars = quiz.distribution.map((d) => ({
    label: String(d.score),
    count: d.count,
  }));
  if (bars.length > 0) drawBars(ctx, bars);
}

function drawQuestion(ctx: Ctx, survey: Survey, q: QuestionResult): void {
  drawSectionHeading(ctx, q.title || "Untitled question");

  const { doc } = ctx;
  doc.setFontSize(9);
  doc.setTextColor(...MUTED_COLOR);
  doc.text(`${q.answered} answered`, MARGIN, ctx.y);
  ctx.y += 16;

  const question = survey.questions.find((s) => s.id === q.questionId);
  const labels = labelMap(question);

  if (q.optionCounts && Object.keys(q.optionCounts).length > 0) {
    const bars = Object.entries(q.optionCounts).map(([id, count]) => ({
      label: labels[id] ?? id,
      count,
    }));
    drawBars(ctx, bars);
    return;
  }

  if (q.textAnswers && q.textAnswers.length > 0) {
    // Short answers are grouped case/whitespace-insensitively to match the
    // on-screen results card; other text types (e.g. date) stay verbatim.
    const entries =
      q.type === "short-answer"
        ? groupTextAnswers(q.textAnswers).map((g) =>
            g.count > 1 ? `${g.label} (×${g.count})` : g.label,
          )
        : q.textAnswers;
    const shown = entries.slice(0, 15);
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_COLOR);
    for (const text of shown) {
      ensureSpace(ctx, 14);
      const lines = doc.splitTextToSize(`• ${text}`, CONTENT_W);
      doc.text(lines, MARGIN, ctx.y);
      ctx.y += 12 * lines.length;
    }
    if (entries.length > shown.length) {
      doc.setTextColor(...MUTED_COLOR);
      doc.text(`… +${entries.length - shown.length} more`, MARGIN, ctx.y);
      ctx.y += 14;
    }
    ctx.y += 8;
    return;
  }

  ctx.y += 4;
}

function drawBars(ctx: Ctx, bars: { label: string; count: number }[]): void {
  const { doc } = ctx;
  const max = Math.max(1, ...bars.map((b) => b.count));
  const labelW = 140;
  const trackW = CONTENT_W - labelW - 40;
  const barH = 12;
  const rowH = 20;

  for (const bar of bars) {
    ensureSpace(ctx, rowH);
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_COLOR);
    const label = doc.splitTextToSize(bar.label, labelW)[0];
    doc.text(label, MARGIN, ctx.y + barH - 2);

    const x = MARGIN + labelW;
    doc.setFillColor(...TRACK_COLOR);
    doc.roundedRect(x, ctx.y, trackW, barH, 2, 2, "F");
    const w = Math.max(1, (bar.count / max) * trackW);
    doc.setFillColor(...BAR_COLOR);
    doc.roundedRect(x, ctx.y, w, barH, 2, 2, "F");

    doc.setTextColor(...MUTED_COLOR);
    doc.text(String(bar.count), x + trackW + 8, ctx.y + barH - 2);
    ctx.y += rowH;
  }
  ctx.y += 10;
}

function drawSectionHeading(ctx: Ctx, text: string): void {
  ensureSpace(ctx, 30);
  const { doc } = ctx;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_COLOR);
  const lines = doc.splitTextToSize(text, CONTENT_W);
  doc.text(lines, MARGIN, ctx.y + 4);
  ctx.y += 14 * lines.length + 4;
  doc.setFont("helvetica", "normal");
}

function buildFilename(title: string): string {
  const safe = (title || "survey")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/_+/g, "_");
  const date = new Date().toISOString().slice(0, 10);
  return `${safe}-results-${date}.pdf`;
}
