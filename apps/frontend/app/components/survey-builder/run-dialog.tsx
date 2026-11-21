"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Spinner } from "@/app/components/ui/spinner";
import { useTranslation } from "@/app/i18n/context";
import { fromLocalInput, toLocalInput } from "@/app/lib/survey/runs";
import type { RunRequest } from "@/app/types/survey";

interface RunDialogProps {
  title: string;
  initial?: RunRequest;
  pending: boolean;
  onSubmit: (data: RunRequest) => Promise<void>;
  onClose: () => void;
}

export function RunDialog({ title, initial, pending, onSubmit, onClose }: RunDialogProps) {
  const { t } = useTranslation();
  const [label, setLabel] = useState(initial?.label ?? "");
  const [opensAt, setOpensAt] = useState(initial ? toLocalInput(initial.opensAt) : "");
  const [closesAt, setClosesAt] = useState(initial ? toLocalInput(initial.closesAt) : "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!label.trim() || !opensAt || !closesAt) {
      setError(t("runs.dialog.required"));
      return;
    }
    const start = fromLocalInput(opensAt, initial?.opensAt);
    const end = fromLocalInput(closesAt, initial?.closesAt);
    if (Date.parse(start) >= Date.parse(end)) {
      setError(t("runs.dialog.order"));
      return;
    }
    setError(null);
    await onSubmit({ label: label.trim(), opensAt: start, closesAt: end });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="run-label">{t("runs.dialog.label")}</Label>
              <Input
                id="run-label"
                value={label}
                maxLength={120}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t("runs.dialog.labelPlaceholder")}
                autoFocus
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="run-opens">{t("runs.dialog.opensAt")}</Label>
                <Input
                  id="run-opens"
                  type="datetime-local"
                  value={opensAt}
                  onChange={(e) => setOpensAt(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="run-closes">{t("runs.dialog.closesAt")}</Label>
                <Input
                  id="run-closes"
                  type="datetime-local"
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                />
              </div>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner className="size-4" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
