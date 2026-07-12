"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Button } from "@/app/components/ui/button";
import { useTranslation } from "@/app/i18n/context";

interface NamePromptDialogProps {
  open: boolean;
  defaultName?: string;
  onSubmit: (name: string) => void;
}

/**
 * Asks a passwordless collaborator for a display name before they start editing
 * (issue #85). Non-dismissible: editing needs an identity so peers can see who
 * is doing what. The name is display-only and never used for authorization.
 */
export function NamePromptDialog({
  open,
  defaultName = "",
  onSubmit,
}: NamePromptDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(defaultName);
  const trimmed = name.trim();

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed) onSubmit(trimmed);
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("collab.name.title")}</DialogTitle>
            <DialogDescription>
              {t("collab.name.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-4">
            <Label htmlFor="collab-name">{t("collab.name.label")}</Label>
            <Input
              id="collab-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("collab.name.placeholder")}
              maxLength={60}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!trimmed}>
              {t("collab.name.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
