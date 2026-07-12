"use client";

import { useState } from "react";
import { Tag, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Badge } from "@/app/components/ui/badge";
import { Spinner } from "@/app/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { useFolders, useOrganizeSurvey } from "@/app/hooks/survey";
import { useTranslation } from "@/app/i18n/context";
import type { Survey } from "@/app/types/survey";

const NO_FOLDER = "__none__";

export function OrganizeDialog({ survey }: { survey: Survey }) {
  const { t } = useTranslation();
  const folders = useFolders();
  const organize = useOrganizeSurvey();
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<string[]>(survey.tags ?? []);
  const [folderId, setFolderId] = useState<string>(survey.folderId ?? NO_FOLDER);
  const [draft, setDraft] = useState("");

  function addTag(value: string) {
    const t = value.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setDraft("");
  }

  async function save() {
    try {
      await organize.mutateAsync({
        id: survey.id,
        tags,
        folderId: folderId === NO_FOLDER ? null : folderId,
      });
      toast.success(t("organize.saved"));
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("organize.saveFailed"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("organize.trigger", { title: survey.title })}
          className="text-muted-foreground hover:text-foreground"
        >
          <Tag className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("organize.title")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>{t("organize.tags")}</Label>
            <div className="flex flex-wrap gap-1">
              {tags.map((tagItem) => (
                <Badge key={tagItem} variant="secondary" className="gap-1">
                  {tagItem}
                  <button
                    type="button"
                    aria-label={t("organize.removeTag", { tag: tagItem })}
                    onClick={() => setTags(tags.filter((x) => x !== tagItem))}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag(draft);
                }
              }}
              onBlur={() => draft && addTag(draft)}
              placeholder={t("organize.tagPlaceholder")}
            />
          </div>

          <div className="grid gap-2">
            <Label>{t("organize.folder")}</Label>
            <Select value={folderId} onValueChange={setFolderId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_FOLDER}>{t("organize.noFolder")}</SelectItem>
                {(folders.data ?? []).map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={organize.isPending}>
            {organize.isPending && <Spinner className="size-4" />}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
