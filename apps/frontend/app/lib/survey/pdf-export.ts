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

/** Categorical palette for pie/donut slices — fixed (not theme-derived) for
 *  the same dark-mode-safe reason as BAR_COLOR. */
const SLICE_COLORS: [number, number, number][] = [
  [37, 99, 235], // blue-600
  [234, 88, 12], // orange-600
  [22, 163, 74], // green-600
  [147, 51, 234], // purple-600
  [219, 39, 119], // pink-600
  [8, 145, 178], // cyan-600
  [202, 138, 4], // yellow-600
  [220, 38, 38], // red-600
];

/**
 * jsPDF's standard 14 fonts (Helvetica/Times/Courier) only implement WinAnsi
 * encoding — a single-byte Latin-1-ish code page. Any character outside it
 * (emoji, CJK, other Unicode symbols) doesn't get rendered as that glyph;
 * jsPDF maps the leftover byte(s) to whatever WinAnsi position they land on,
 * which is the "⭐" → "+P"-style mojibake this fixes. Emoji runs are drawn with
 * the embedded Noto Emoji font (monochrome outline glyphs, OFL-licensed,
 * public/fonts/NotoEmoji-Regular.ttf) instead; everything else stays on
 * Helvetica. If the font fails to load (offline, blocked), those runs are
 * dropped rather than shown as mojibake.
 */
const EMOJI_FONT_NAME = "NotoEmoji";
const EMOJI_FONT_FILE = "NotoEmoji-Regular.ttf";
const EMOJI_FONT_URL = "/fonts/NotoEmoji-Regular.ttf";

async function loadEmojiFont(doc: import("jspdf").jsPDF): Promise<boolean> {
  try {
    const res = await fetch(EMOJI_FONT_URL);
    if (!res.ok) return false;
    const buf = await res.arrayBuffer();
    doc.addFileToVFS(EMOJI_FONT_FILE, arrayBufferToBase64(buf));
    doc.addFont(EMOJI_FONT_FILE, EMOJI_FONT_NAME, "normal");
    return true;
  } catch {
    return false;
  }
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** Splits text into runs of consecutive WinAnsi-safe vs. emoji/exotic
 *  characters, so each run can be drawn with the right font. */
function splitTextRuns(text: string): { text: string; emoji: boolean }[] {
  const runs: { text: string; emoji: boolean }[] = [];
  let current = "";
  let currentEmoji = false;
  for (const ch of Array.from(text)) {
    const isEmoji = (ch.codePointAt(0) ?? 0) > 0xff;
    if (current && isEmoji !== currentEmoji) {
      runs.push({ text: current, emoji: currentEmoji });
      current = "";
    }
    current += ch;
    currentEmoji = isEmoji;
  }
  if (current) runs.push({ text: current, emoji: currentEmoji });
  return runs;
}

/** Total rendered width of mixed runs, using each run's actual font so
 *  center-alignment lines up correctly even when an emoji run is present. */
function mixedTextWidth(ctx: Ctx, runs: { text: string; emoji: boolean }[]): number {
  const { doc } = ctx;
  let width = 0;
  for (const run of runs) {
    if (run.emoji && !ctx.emojiFontReady) continue;
    doc.setFont(run.emoji ? EMOJI_FONT_NAME : "helvetica", "normal");
    width += doc.getTextWidth(run.text);
  }
  doc.setFont("helvetica", "normal");
  return width;
}

/** Draws one line of text, switching to the embedded emoji font for any run
 *  outside Helvetica's WinAnsi coverage. Leaves the font set to plain
 *  Helvetica afterward. `align: "center"` centers the whole line on `x`. */
function drawMixedText(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  style: "normal" | "bold" = "normal",
  align: "left" | "center" = "left",
): void {
  const { doc } = ctx;
  const runs = splitTextRuns(text);
  let cursorX = align === "center" ? x - mixedTextWidth(ctx, runs) / 2 : x;
  for (const run of runs) {
    if (run.emoji) {
      if (!ctx.emojiFontReady) continue; // drop rather than render mojibake
      doc.setFont(EMOJI_FONT_NAME, "normal");
    } else {
      doc.setFont("helvetica", style);
    }
    doc.text(run.text, cursorX, y);
    cursorX += doc.getTextWidth(run.text);
  }
  doc.setFont("helvetica", "normal");
}

const MARGIN = 40;
const PAGE_W = 595; // A4 portrait, pt
const PAGE_H = 842;
const CONTENT_W = PAGE_W - MARGIN * 2;

/** Matches the chart type picker on the on-screen results card (issue #87). */
export type PdfChartType = "bar" | "pie" | "donut" | "line";

export interface PdfExportData {
  survey: Survey;
  results: SurveyResults;
  /** Average completion time in ms, or null. */
  avgDurationMs: number | null;
  /** The chart type currently selected on-screen for each question (by id),
   *  so the export matches what the owner is looking at instead of always
   *  drawing bars. Missing entries fall back to "bar". */
  chartTypes?: Record<string, PdfChartType>;
}

/** Generate and download a results PDF. */
export async function exportResultsPdf(data: PdfExportData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const emojiFontReady = await loadEmojiFont(doc);

  const ctx = { doc, y: MARGIN, emojiFontReady };

  drawTitle(ctx, data);
  drawKpis(ctx, data);
  if (data.results.quiz) drawQuiz(ctx, data.results.quiz);
  for (const q of data.results.questions) {
    drawQuestion(ctx, data.survey, q, data.chartTypes?.[q.questionId] ?? "bar");
  }

  doc.save(buildFilename(data.survey.title));
}

interface Ctx {
  doc: import("jspdf").jsPDF;
  y: number;
  /** Whether the embedded emoji font loaded successfully (#). */
  emojiFontReady: boolean;
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
  drawMixedText(ctx, data.survey.title || "Survey results", MARGIN, ctx.y + 6, "bold");
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

function drawQuestion(
  ctx: Ctx,
  survey: Survey,
  q: QuestionResult,
  chartType: PdfChartType,
): void {
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
    if (chartType === "pie" || chartType === "donut") {
      drawPieChart(ctx, bars, chartType === "donut");
    } else if (chartType === "line") {
      drawLineChart(ctx, bars);
    } else {
      drawBars(ctx, bars);
    }
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
      for (const line of lines) {
        drawMixedText(ctx, line, MARGIN, ctx.y);
        ctx.y += 12;
      }
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
    drawMixedText(ctx, label, MARGIN, ctx.y + barH - 2);

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

/** Filled pie/donut slice, approximated as a polygon (jsPDF has no native arc
 *  primitive) — `steps` line segments per slice is plenty at PDF resolution. */
function drawArcSlice(
  doc: import("jspdf").jsPDF,
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
): void {
  const steps = Math.max(2, Math.ceil(((endAngle - startAngle) / (Math.PI * 2)) * 60));
  const outerPts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = startAngle + ((endAngle - startAngle) * i) / steps;
    outerPts.push([cx + outerR * Math.cos(a), cy + outerR * Math.sin(a)]);
  }
  let points: [number, number][];
  if (innerR > 0) {
    const innerPts: [number, number][] = [];
    for (let i = steps; i >= 0; i--) {
      const a = startAngle + ((endAngle - startAngle) * i) / steps;
      innerPts.push([cx + innerR * Math.cos(a), cy + innerR * Math.sin(a)]);
    }
    points = [...outerPts, ...innerPts];
  } else {
    points = [[cx, cy], ...outerPts];
  }
  const [first, ...rest] = points;
  const segments = rest.map((p, i) => {
    const prev = points[i];
    return [p[0] - prev[0], p[1] - prev[1]] as [number, number];
  });
  doc.lines(segments, first[0], first[1], [1, 1], "F", true);
}

function drawPieChart(
  ctx: Ctx,
  bars: { label: string; count: number }[],
  donut: boolean,
): void {
  const { doc } = ctx;
  const total = bars.reduce((s, b) => s + b.count, 0) || 1;
  const radius = 60;
  const innerRadius = donut ? radius * 0.55 : 0;
  const legendX = MARGIN + radius * 2 + 30;
  const rowH = 14;
  const neededHeight = Math.max(radius * 2 + 20, bars.length * rowH + 10);
  ensureSpace(ctx, neededHeight);

  const cx = MARGIN + radius;
  const cy = ctx.y + radius;

  let angle = -Math.PI / 2; // start at 12 o'clock
  const segments = bars.map((b, i) => {
    const sweep = (b.count / total) * Math.PI * 2;
    const seg = { ...b, color: SLICE_COLORS[i % SLICE_COLORS.length], start: angle, end: angle + sweep };
    angle += sweep;
    return seg;
  });

  for (const seg of segments) {
    doc.setFillColor(...seg.color);
    drawArcSlice(doc, cx, cy, innerRadius, radius, seg.start, seg.end);
  }

  doc.setFontSize(9);
  let legendY = ctx.y + 6;
  for (const seg of segments) {
    doc.setFillColor(...seg.color);
    doc.rect(legendX, legendY - 8, 8, 8, "F");
    doc.setTextColor(...TEXT_COLOR);
    const pct = Math.round((seg.count / total) * 100);
    const label = doc.splitTextToSize(
      `${seg.label} — ${pct}%`,
      Math.max(60, CONTENT_W - (legendX - MARGIN)),
    )[0];
    drawMixedText(ctx, label, legendX + 12, legendY);
    legendY += rowH;
  }

  ctx.y += neededHeight + 12;
}

function drawLineChart(ctx: Ctx, bars: { label: string; count: number }[]): void {
  if (bars.length === 0) return;
  const { doc } = ctx;
  const max = Math.max(1, ...bars.map((b) => b.count));
  const chartH = 100;
  ensureSpace(ctx, chartH + 34);
  const top = ctx.y;
  const baseline = top + chartH;
  const stepX = bars.length > 1 ? CONTENT_W / (bars.length - 1) : 0;

  doc.setDrawColor(...TRACK_COLOR);
  doc.line(MARGIN, baseline, MARGIN + CONTENT_W, baseline);

  const points = bars.map((b, i) => ({
    x: MARGIN + i * stepX,
    y: baseline - (b.count / max) * chartH,
    b,
  }));

  doc.setDrawColor(...BAR_COLOR);
  doc.setLineWidth(1.5);
  for (let i = 0; i < points.length - 1; i++) {
    doc.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
  }
  doc.setLineWidth(1);
  doc.setFillColor(...BAR_COLOR);
  for (const p of points) {
    doc.circle(p.x, p.y, 2, "F");
  }

  doc.setFontSize(8);
  doc.setTextColor(...MUTED_COLOR);
  for (const p of points) {
    const label = doc.splitTextToSize(p.b.label, Math.max(20, stepX))[0];
    drawMixedText(ctx, label, p.x, baseline + 14, "normal", "center");
  }

  ctx.y = baseline + 26;
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
