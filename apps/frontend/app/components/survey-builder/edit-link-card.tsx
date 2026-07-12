"use client";

import { useRef } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Spinner } from "@/app/components/ui/spinner";
import { useIsClient } from "@/app/hooks/use-is-client";
import {
  useCollabLink,
  useRotateCollabLink,
  useUpdateCollabLink,
} from "@/app/hooks/survey";
import { useTranslation } from "@/app/i18n/context";

function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Owner control for the passwordless editing link (issue #22). */
export function EditLinkCard({ surveyId }: { surveyId: string }) {
  const { t } = useTranslation();
  const mounted = useIsClient();
  const link = useCollabLink(surveyId, mounted);
  const rotate = useRotateCollabLink(surveyId);
  const update = useUpdateCollabLink(surveyId);
  const expiryRef = useRef<HTMLInputElement>(null);

  if (link.isLoading || !mounted) return <Spinner className="size-5" />;
  const data = link.data;
  if (!data) return null;

  const url = `${window.location.origin}/collab/${data.slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("share.edit.copied"));
    } catch {
      toast.error(t("common.copyFailed"));
    }
  }

  async function applyExpiry() {
    const value = expiryRef.current?.value ?? "";
    try {
      await update.mutateAsync(value ? new Date(value).toISOString() : null);
      toast.success(t("share.edit.validityUpdated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.updateFailed"));
    }
  }

  async function handleRotate() {
    if (!window.confirm(t("share.edit.rotateConfirm"))) return;
    try {
      await rotate.mutateAsync();
      toast.success(t("share.edit.rotated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.rotateFailed"));
    }
  }

  return (
    <div className="grid gap-3 rounded-lg border border-dashed p-3" key={data.slug}>
      <p className="text-sm font-medium">{t("share.edit.title")}</p>
      <p className="text-xs text-muted-foreground">
        {t("share.edit.description")}
      </p>
      <div className="flex items-center gap-2">
        <Input readOnly value={url} className="font-mono text-xs" />
        <Button onClick={copy}>
          <Copy className="size-4" />
          {t("common.copy")}
        </Button>
        <Button variant="outline" onClick={handleRotate} disabled={rotate.isPending}>
          {rotate.isPending ? <Spinner className="size-4" /> : <RefreshCw className="size-4" />}
          {t("common.rotate")}
        </Button>
      </div>
      <div className="flex items-end gap-2">
        <div className="grid gap-1">
          <Label htmlFor="collab-expiry" className="text-xs">
            {t("share.edit.validUntil")}
          </Label>
          <Input
            id="collab-expiry"
            type="datetime-local"
            ref={expiryRef}
            defaultValue={toLocalInput(data.expiresAt)}
          />
        </div>
        <Button variant="secondary" onClick={applyExpiry} disabled={update.isPending}>
          {update.isPending && <Spinner className="size-4" />}
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}
