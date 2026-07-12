"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Spinner } from "@/app/components/ui/spinner";
import { useTranslation } from "@/app/i18n/context";

interface FolderNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submitLabel: string;
  initialName?: string;
  pending?: boolean;
  onSubmit: (name: string) => void;
}

/**
 * In-app folder name dialog (create / rename) — replaces the browser prompt so
 * it works in the native app and matches the rest of the UI (#).
 */
export function FolderNameDialog({
  open,
  onOpenChange,
  title,
  submitLabel,
  initialName = "",
  pending = false,
  onSubmit,
}: FolderNameDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);

  // Reset the field to the starting value each time the dialog opens.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setName(initialName);
  }, [open, initialName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = name.trim();
            if (trimmed) onSubmit(trimmed);
          }}
          className="grid gap-4"
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("dashboard.folder.namePrompt")}
            autoFocus
            maxLength={80}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!name.trim() || pending}>
              {pending && <Spinner className="size-4" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
