"use client";

import { RichText } from "@/app/components/common/rich-text";
import { uploadFileUrl } from "@/app/lib/survey/api";
import { getContentImage } from "@/app/lib/survey/content-block";
import type { QuestionPreviewProps } from "../types";

/**
 * A content block's body (public #7): Markdown text and an optional image.
 * Takes no answer — `value`/`onChange` are ignored.
 */
export function ContentPreview({ question }: QuestionPreviewProps) {
  const image = getContentImage(question);
  const body = question.description?.trim() ?? "";
  return (
    <div className="grid gap-4">
      {body && <RichText markdown={body} />}
      {image && (
        // eslint-disable-next-line @next/next/no-img-element -- API-proxied upload
        <img
          src={uploadFileUrl(image.key)}
          alt={image.alt}
          className="max-h-[28rem] w-full rounded-md object-contain"
        />
      )}
    </div>
  );
}
