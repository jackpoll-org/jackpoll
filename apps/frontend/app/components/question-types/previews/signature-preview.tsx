"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, PenLine } from "lucide-react";
import { Spinner } from "@/app/components/ui/spinner";
import { uploadFileApi } from "@/app/lib/survey/api";
import type { UploadedFile } from "@/app/types/survey";
import type { QuestionPreviewProps } from "../types";
import { useTranslation } from "@/app/i18n/context";

/** Preview / answer renderer for signature questions (draw → upload as PNG). */
export function SignaturePreview({
  value,
  onChange,
  disabled,
}: QuestionPreviewProps) {
  const { t } = useTranslation();
  const interactive = !!onChange && !disabled;
  const files: UploadedFile[] = Array.isArray(value) ? (value as UploadedFile[]) : [];
  const saved = files[0];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    // Size the canvas backing store to its displayed size. Re-run on resize /
    // orientation change (e.g. rotating a phone to landscape) so the drawing
    // coordinates stay aligned with the visible box.
    const setup = () => {
      const ratio = window.devicePixelRatio || 1;
      const rect = c.getBoundingClientRect();
      if (rect.width === 0) return;
      c.width = rect.width * ratio;
      c.height = rect.height * ratio;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.scale(ratio, ratio);
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = getComputedStyle(c).color || "#000";
      }
    };
    setup();
    window.addEventListener("resize", setup);
    window.addEventListener("orientationchange", setup);
    return () => {
      window.removeEventListener("resize", setup);
      window.removeEventListener("orientationchange", setup);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!interactive) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <PenLine className="size-5" />
        {t("qtype.signature")}
      </div>
    );
  }

  const ctx = () => canvasRef.current?.getContext("2d") ?? null;
  const point = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function down(e: React.PointerEvent) {
    const c = ctx();
    if (!c) return;
    drawing.current = true;
    const { x, y } = point(e);
    c.beginPath();
    c.moveTo(x, y);
    canvasRef.current?.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const c = ctx();
    if (!c) return;
    const { x, y } = point(e);
    c.lineTo(x, y);
    c.stroke();
  }
  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    // Debounce so a multi-stroke signature uploads once after the user pauses.
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(upload, 600);
  }

  function upload() {
    const c = canvasRef.current;
    if (!c) return;
    setError(null);
    setUploading(true);
    c.toBlob(async (blob) => {
      if (!blob) {
        setUploading(false);
        return;
      }
      try {
        const file = new File([blob], "signature.png", { type: "image/png" });
        const uploaded = await uploadFileApi(file);
        onChange?.([uploaded]);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("qprev.uploadFailed"));
      } finally {
        setUploading(false);
      }
    }, "image/png");
  }

  function clear() {
    const c = canvasRef.current;
    const context = ctx();
    if (c && context) context.clearRect(0, 0, c.width, c.height);
    if (timer.current) clearTimeout(timer.current);
    onChange?.([]);
  }

  return (
    <div className="grid gap-2">
      <canvas
        ref={canvasRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        className="h-40 w-full touch-none rounded-lg border bg-background text-foreground"
        aria-label={t("qprev.signature.pad")}
      />
      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Eraser className="size-4" /> {t("qprev.signature.clear")}
        </button>
        {uploading && (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Spinner className="size-4" /> {t("qprev.signature.saving")}
          </span>
        )}
        {!uploading && saved && (
          <span className="text-muted-foreground">{t("qprev.signature.saved")}</span>
        )}
        {error && <span className="text-destructive">{error}</span>}
      </div>
    </div>
  );
}
