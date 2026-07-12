"use client";

import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { Switch } from "@/app/components/ui/switch";
import { Spinner } from "@/app/components/ui/spinner";
import {
  useAccessCode,
  useRotateAccessCode,
  useUpdateAccessCode,
} from "@/app/hooks/survey";
import { useTranslation } from "@/app/i18n/context";

interface AccessCodeCardProps {
  surveyId: string;
  isPublished: boolean;
}

export function AccessCodeCard({ surveyId, isPublished }: AccessCodeCardProps) {
  const { t } = useTranslation();
  const accessCode = useAccessCode(surveyId, isPublished);
  const rotate = useRotateAccessCode(surveyId);
  const update = useUpdateAccessCode(surveyId);

  if (!isPublished) {
    return (
      <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
        {t("share.code.notPublished")}
      </p>
    );
  }

  if (accessCode.isLoading) {
    return <Spinner className="size-5" />;
  }

  const data = accessCode.data;
  if (!data) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(data!.code);
      toast.success(t("share.code.copied"));
    } catch {
      toast.error(t("common.copyFailed"));
    }
  }

  async function handleRotate() {
    if (!window.confirm(t("share.code.rotateConfirm"))) {
      return;
    }
    try {
      await rotate.mutateAsync();
      toast.success(t("share.code.rotated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.rotateFailed"));
    }
  }

  async function toggleRequire(checked: boolean) {
    try {
      await update.mutateAsync(checked);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.updateFailed"));
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <span className="rounded-md border bg-card px-4 py-2 font-mono text-xl font-semibold tracking-widest">
          {data.code}
        </span>
        <Button onClick={copy}>
          <Copy className="size-4" />
          {t("common.copy")}
        </Button>
        <Button variant="outline" onClick={handleRotate} disabled={rotate.isPending}>
          {rotate.isPending ? <Spinner className="size-4" /> : <RefreshCw className="size-4" />}
          {t("common.rotate")}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="require-code"
          checked={data.requireCode}
          onCheckedChange={toggleRequire}
          disabled={update.isPending}
        />
        <Label htmlFor="require-code" className="font-normal">
          {t("share.code.require")}
        </Label>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("share.code.enterAt")} <strong>/join</strong>.{" "}
        {t("share.code.lastRotated", {
          date: new Date(data.lastRotatedAt).toLocaleString(),
        })}
      </p>
    </div>
  );
}
