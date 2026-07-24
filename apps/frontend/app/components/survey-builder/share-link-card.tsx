"use client";

import { useRef } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Spinner } from "@/app/components/ui/spinner";
import {
  useRotateShareLink,
  useShareLink,
  useUpdateShareLink,
} from "@/app/hooks/survey";
import { useTranslation } from "@/app/i18n/context";

function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface ShareLinkCardProps {
  surveyId: string;
  origin: string;
  isPublished: boolean;
}

export function ShareLinkCard({ surveyId, origin, isPublished }: ShareLinkCardProps) {
  const { t } = useTranslation();
  const link = useShareLink(surveyId, isPublished);
  const rotate = useRotateShareLink(surveyId);
  const update = useUpdateShareLink(surveyId);
  const expiryRef = useRef<HTMLInputElement>(null);
  const maxRef = useRef<HTMLInputElement>(null);

  if (!isPublished) {
    return (
      <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
        {t("share.link.notPublished")}
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

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("share.link.copied"));
    } catch {
      toast.error(t("common.copyFailed"));
    }
  }

  async function applyLimits() {
    const expiryValue = expiryRef.current?.value ?? "";
    const maxValue = maxRef.current?.value ?? "";
    try {
      await update.mutateAsync({
        expiresAt: expiryValue ? new Date(expiryValue).toISOString() : null,
        maxResponses: maxValue ? Number(maxValue) : null,
      });
      toast.success(t("share.link.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  }

  async function handleRotate() {
    if (!window.confirm(t("share.link.rotateConfirm"))) {
      return;
    }
    try {
      await rotate.mutateAsync();
      toast.success(t("share.link.rotated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.rotateFailed"));
    }
  }

  return (
    <div className="grid gap-3" key={data.slug}>
      <div className="flex flex-wrap items-center gap-2">
        <Input readOnly value={url} className="min-w-0 flex-1 font-mono text-xs" />
        <Button onClick={copy}>
          <Copy className="size-4" />
          {t("common.copy")}
        </Button>
        <Button variant="outline" onClick={handleRotate} disabled={rotate.isPending}>
          {rotate.isPending ? <Spinner className="size-4" /> : <RefreshCw className="size-4" />}
          {t("common.rotate")}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label htmlFor="link-expiry" className="text-xs">
            {t("share.link.expiresAt")}
          </Label>
          <Input
            id="link-expiry"
            type="datetime-local"
            ref={expiryRef}
            defaultValue={toLocalInput(data.expiresAt)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="link-max" className="text-xs">
            {t("share.link.maxResponses", { count: String(data.responseCount) })}
          </Label>
          <Input
            id="link-max"
            type="number"
            min={0}
            ref={maxRef}
            defaultValue={data.maxResponses ?? ""}
          />
        </div>
      </div>

      <div>
        <Button variant="secondary" onClick={applyLimits} disabled={update.isPending}>
          {update.isPending && <Spinner className="size-4" />}
          {t("share.link.saveSettings")}
        </Button>
      </div>
    </div>
  );
}
