"use client";

import { useRef } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Spinner } from "@/app/components/ui/spinner";
import { useShareLink } from "@/app/hooks/survey";
import { downloadText } from "@/app/lib/survey/export";
import { useTranslation } from "@/app/i18n/context";

interface QrCodeCardProps {
  surveyId: string;
  origin: string;
  isPublished: boolean;
}

export function QrCodeCard({ surveyId, origin, isPublished }: QrCodeCardProps) {
  const { t } = useTranslation();
  const link = useShareLink(surveyId, isPublished);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!isPublished) {
    return (
      <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
        {t("share.qr.notPublished")}
      </p>
    );
  }

  if (link.isLoading) {
    return <Spinner className="size-5" />;
  }

  if (link.isError) {
    return (
      <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {link.error instanceof Error ? link.error.message : t("share.link.loadError")}
      </p>
    );
  }

  const data = link.data;
  if (!data) return null;

  const url = `${origin}/s/${data.slug}`;

  function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "survey-qr.png";
    a.click();
  }

  function downloadSvg() {
    const svg = svgRef.current;
    if (!svg) return;
    downloadText(
      "survey-qr.svg",
      new XMLSerializer().serializeToString(svg),
      "image/svg+xml",
    );
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("share.link.copied"));
    } catch {
      toast.error(t("common.copyFailed"));
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
      <div className="rounded-lg border bg-white p-3">
        <QRCodeCanvas ref={canvasRef} value={url} size={160} level="M" marginSize={2} />
        {/* Hidden SVG used only for the vector download. */}
        <QRCodeSVG ref={svgRef} value={url} size={160} level="M" className="hidden" />
      </div>

      <div className="grid gap-2">
        <p className="text-sm text-muted-foreground">
          {t("share.qr.description")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={downloadPng}>
            <Download className="size-4" />
            PNG
          </Button>
          <Button variant="outline" size="sm" onClick={downloadSvg}>
            <Download className="size-4" />
            SVG
          </Button>
          <Button variant="outline" size="sm" onClick={copyLink}>
            <Copy className="size-4" />
            {t("share.qr.copyLink")}
          </Button>
        </div>
      </div>
    </div>
  );
}
