"use client";

import { useState } from "react";
import { ListPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/textarea";
import { useTranslation } from "@/app/i18n/context";

export function BulkOptionsDialog({ onAdd }: { onAdd: (text: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onAdd(text);
    setText("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          <ListPlus className="size-4" />
          {t("qedit.bulk.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t("qedit.bulk.title")}</DialogTitle>
            <DialogDescription>{t("qedit.bulk.description")}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            aria-label={t("qedit.bulk.title")}
            autoFocus
          />
          <DialogFooter>
            <Button type="submit" disabled={text.trim() === ""}>
              {t("qedit.bulk.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
