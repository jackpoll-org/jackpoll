"use client";

import { useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/textarea";
import { Separator } from "@/app/components/ui/separator";
import { useIsClient } from "@/app/hooks/use-is-client";
import { useTranslation } from "@/app/i18n/context";
import type { SurveyStatus } from "@/app/types/survey";
import { ShareLinkCard } from "./share-link-card";
import { AccessCodeCard } from "./access-code-card";
import { QrCodeCard } from "./qr-code-card";

interface EmbedDialogProps {
  surveyId: string;
  status: SurveyStatus;
}

export function EmbedDialog({ surveyId, status }: EmbedDialogProps) {
  const { t } = useTranslation();
  const mounted = useIsClient();
  const [open, setOpen] = useState(false);

  const origin = mounted ? window.location.origin : "";
  const embedUrl = `${origin}/embed/${surveyId}`;
  const snippet = `<iframe src="${embedUrl}" width="100%" height="600" style="border:0" title="Survey"></iframe>`;
  const isPublished = status === "published";

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      toast.success(t("share.embed.copied"));
    } catch {
      toast.error(t("common.copyFailed"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Share2 className="size-4" />
          {t("share.embed.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("share.embed.title")}</DialogTitle>
          <DialogDescription>
            {t("share.embed.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <h3 className="text-sm font-medium">{t("share.embed.sectionLink")}</h3>
          <ShareLinkCard
            surveyId={surveyId}
            origin={origin}
            isPublished={isPublished}
          />
        </div>

        <Separator />

        <div className="grid gap-2">
          <h3 className="text-sm font-medium">{t("share.embed.sectionQr")}</h3>
          <QrCodeCard surveyId={surveyId} origin={origin} isPublished={isPublished} />
        </div>

        <Separator />

        <div className="grid gap-2">
          <h3 className="text-sm font-medium">{t("share.embed.sectionCode")}</h3>
          <AccessCodeCard surveyId={surveyId} isPublished={isPublished} />
        </div>

        <Separator />

        <div className="grid gap-2">
          <h3 className="text-sm font-medium">{t("share.embed.sectionEmbed")}</h3>
          {!isPublished && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              {t("share.embed.notPublished")}
            </p>
          )}
          <Textarea readOnly value={snippet} rows={3} className="font-mono text-xs" />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={copy} disabled={!mounted}>
              <Copy className="size-4" />
              {t("share.embed.copyCode")}
            </Button>
            <Button asChild variant="outline">
              <a href={embedUrl} target="_blank" rel="noopener noreferrer">
                {t("share.embed.openPreview")}
              </a>
            </Button>
          </div>
        </div>

        {mounted && isPublished && (
          <div className="overflow-hidden rounded-lg border">
            <iframe
              src={embedUrl}
              title="Embed preview"
              className="h-80 w-full"
              // Curated sandbox: the preview frames our own survey page, which
              // needs to run its scripts and submit the response form, but is
              // otherwise denied capabilities (popups, top-level navigation…).
              sandbox="allow-scripts allow-forms allow-same-origin"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
