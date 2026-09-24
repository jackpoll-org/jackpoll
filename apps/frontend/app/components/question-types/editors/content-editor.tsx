"use client";

import { useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { RichText } from "@/app/components/common/rich-text";
import { useTranslation } from "@/app/i18n/context";
import { uploadFileApi, uploadFileUrl } from "@/app/lib/survey/api";
import { getContentImage, type ContentImage } from "@/app/lib/survey/content-block";
import type { QuestionEditorProps } from "../types";

const IMAGE_TYPES = "image/png,image/jpeg,image/gif,image/webp";

/**
 * Editor for a content block (public #7): Markdown body with a live preview,
 * plus an optional uploaded image. The body lives in `description`.
 */
export function ContentEditor({ question, onChange }: QuestionEditorProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const image = getContentImage(question);
  const body = question.description ?? "";

  function setImage(next: ContentImage | null) {
    onChange({ settings: { ...(question.settings ?? {}), image: next } });
  }

  async function upload(file: File) {
    setUploading(true);
    try {
      const uploaded = await uploadFileApi(file);
      setImage({ key: uploaded.key, alt: image?.alt ?? "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("qedit.content.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Tabs defaultValue="write">
        <TabsList>
          <TabsTrigger value="write">{t("qedit.content.write")}</TabsTrigger>
          <TabsTrigger value="preview">{t("qedit.content.preview")}</TabsTrigger>
        </TabsList>
        <TabsContent value="write" className="grid gap-1">
          <Textarea
            aria-label={t("qedit.content.body")}
            rows={6}
            value={body}
            placeholder={t("qedit.content.placeholder")}
            onChange={(e) => onChange({ description: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">{t("qedit.content.markdownHelp")}</p>
        </TabsContent>
        <TabsContent value="preview" className="min-h-24 rounded-md border p-3">
          {body.trim() ? (
            <RichText markdown={body} />
          ) : (
            <p className="text-sm text-muted-foreground">{t("qedit.content.empty")}</p>
          )}
        </TabsContent>
      </Tabs>

      {image ? (
        <div className="grid gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- API-proxied upload */}
          <img
            src={uploadFileUrl(image.key)}
            alt={image.alt}
            className="max-h-64 w-fit rounded-md border object-contain"
          />
          <div className="flex items-end gap-2">
            <div className="grid flex-1 gap-1">
              <Label htmlFor={`${question.id}-alt`} className="text-xs">
                {t("qedit.content.imageAlt")}
              </Label>
              <Input
                id={`${question.id}-alt`}
                value={image.alt}
                onChange={(e) => setImage({ ...image, alt: e.target.value })}
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setImage(null)}>
              <Trash2 className="size-4" /> {t("qedit.content.removeImage")}
            </Button>
          </div>
        </div>
      ) : (
        <Label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-normal hover:bg-accent">
          <ImagePlus className="size-4" />
          {uploading ? t("common.loading") : t("qedit.content.addImage")}
          <input
            type="file"
            accept={IMAGE_TYPES}
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }}
          />
        </Label>
      )}
    </div>
  );
}
