"use client";

import { useState } from "react";
import { BookmarkPlus } from "lucide-react";
import { toast } from "sonner";
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
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Spinner } from "@/app/components/ui/spinner";
import { useCreateTemplate } from "@/app/hooks/templates";
import { useTranslation } from "@/app/i18n/context";
import { useBuilder } from "./builder-context";

export function SaveTemplateDialog() {
  const { t } = useTranslation();
  const { survey } = useBuilder();
  const createTemplate = useCreateTemplate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(survey.title);
  const [description, setDescription] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await createTemplate.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        questions: survey.questions,
        settings: survey.settings,
      });
      toast.success(t("template.saved"));
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("template.saveFailed"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <BookmarkPlus className="size-4" />
          {t("template.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSave}>
          <DialogHeader>
            <DialogTitle>{t("template.title")}</DialogTitle>
            <DialogDescription>
              {t("template.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="template-name">{t("template.nameLabel")}</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="template-desc">{t("template.descriptionLabel")}</Label>
              <Textarea
                id="template-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={createTemplate.isPending}>
              {createTemplate.isPending && <Spinner className="size-4" />}
              {t("template.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
