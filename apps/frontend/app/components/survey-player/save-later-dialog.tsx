"use client";

import { useState } from "react";
import { Check, Clock, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Spinner } from "@/app/components/ui/spinner";
import { useTranslation } from "@/app/i18n/context";

interface SaveLaterDialogProps {
  /** Persists the draft and resolves to the resume token. */
  onSave: () => Promise<string>;
}

/** "Save & continue later" action: persists a draft and shows a resume link. */
export function SaveLaterDialog({ onSave }: SaveLaterDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    setSaving(true);
    try {
      const token = await onSave();
      const url = `${window.location.origin}/r/${token}`;
      setLink(url);
      setCopied(false);
      setOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("draft.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success(t("draft.copied"));
    } catch {
      // Clipboard may be blocked; the link is still selectable in the field.
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={handleClick}
        disabled={saving}
      >
        {saving ? <Spinner className="size-4" /> : <Clock className="size-4" />}
        {t("draft.saveLater")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("draft.dialogTitle")}</DialogTitle>
            <DialogDescription>{t("draft.dialogBody")}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input readOnly value={link} onFocus={(e) => e.target.select()} />
            <Button type="button" variant="secondary" onClick={copy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {t("draft.copyLink")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
