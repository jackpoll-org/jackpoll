"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Camera, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/app/components/ui/spinner";
import { uploadFileApi, uploadFileUrl } from "@/app/lib/survey/api";
import { capturePhoto, isNativePlatform } from "@/app/lib/native/camera";
import type { UploadedFile } from "@/app/types/survey";
import type { QuestionPreviewProps } from "../types";
import { useTranslation } from "@/app/i18n/context";

const ALLOWED = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_SET = new Set(ALLOWED);

/** Preview / answer renderer for file-upload questions (images via MinIO). */
export function FileUploadPreview({
  question,
  value,
  onChange,
  disabled,
}: QuestionPreviewProps) {
  const { t } = useTranslation();
  const interactive = !!onChange && !disabled;
  const multiple = question.settings?.multiple === true;
  const maxSizeMb = Number(question.settings?.maxSizeMb) || 10;
  const files: UploadedFile[] = Array.isArray(value)
    ? (value as UploadedFile[])
    : [];

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // Resolved after mount to avoid a server/client hydration mismatch.
  const [native, setNative] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNative(isNativePlatform());
  }, []);

  if (!interactive) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <UploadCloud className="size-5" />
        {multiple ? t("qprev.file.labelMultiple") : t("qprev.file.label")}
      </div>
    );
  }

  async function handleFiles(list: FileList | null) {
    if (!list) return;
    await uploadFiles(Array.from(list));
  }

  async function uploadFiles(selected: File[]) {
    if (selected.length === 0 || !onChange) return;
    setError(null);

    for (const f of selected) {
      if (!ALLOWED_SET.has(f.type)) {
        setError(t("qprev.file.onlyImages"));
        return;
      }
      if (f.size > maxSizeMb * 1024 * 1024) {
        setError(t("qprev.file.maxSize", { mb: String(maxSizeMb) }));
        return;
      }
    }

    setUploading(true);
    try {
      // Upload in parallel rather than awaiting each file sequentially.
      const uploaded = await Promise.all(selected.map((f) => uploadFileApi(f)));
      onChange(multiple ? [...files, ...uploaded] : uploaded.slice(0, 1));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("qprev.uploadFailed"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(key: string) {
    onChange?.(files.filter((f) => f.key !== key));
  }

  // Native camera capture (mobile phase 3); web uses the file input.
  async function takePhoto() {
    setError(null);
    try {
      const file = await capturePhoto();
      if (file) await uploadFiles([file]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("qprev.file.cameraUnavailable"));
    }
  }

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground transition-colors hover:border-primary/50",
          dragOver && "border-primary bg-accent",
        )}
      >
        {uploading ? (
          <Spinner className="size-5" />
        ) : (
          <UploadCloud className="size-6" />
        )}
        <span>
          {uploading ? t("qprev.file.uploading") : t("qprev.file.dropHint")}
        </span>
        <input
          ref={inputRef}
          type="file"
          aria-label={t("qprev.file.uploadAria")}
          accept={ALLOWED.join(",")}
          multiple={multiple}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </button>

      {native && (
        <button
          type="button"
          onClick={takePhoto}
          disabled={uploading}
          className="flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
        >
          <Camera className="size-4" />
          {t("qprev.file.takePhoto")}
        </button>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {files.map((file) => (
            <div
              key={file.key}
              className="group relative aspect-square overflow-hidden rounded-md border"
            >
              <Image
                src={uploadFileUrl(file.key)}
                alt={file.filename}
                fill
                unoptimized
                sizes="120px"
                className="object-cover"
              />
              <button
                type="button"
                aria-label={t("qprev.file.removeFile", { name: file.filename })}
                onClick={() => remove(file.key)}
                className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-foreground opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
