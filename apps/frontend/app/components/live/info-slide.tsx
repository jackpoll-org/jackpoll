"use client";

import { RichText } from "@/app/components/common/rich-text";
import { uploadFileUrl } from "@/app/lib/survey/api";
import { getContentImage } from "@/app/lib/survey/content-block";
import type { Question } from "@/app/types/survey";

/**
 * A content block (public #7) shown as an info slide on the presenter screen:
 * the same Markdown text and image as in the form, sized for a projector.
 */
export function InfoSlide({ slide }: { slide: Question }) {
  const image = getContentImage(slide);
  const body = slide.description?.trim() ?? "";
  return (
    <div className="grid gap-6">
      {body && <RichText markdown={body} className="text-center text-xl sm:text-2xl" />}
      {image && (
        // eslint-disable-next-line @next/next/no-img-element -- API-proxied upload
        <img
          src={uploadFileUrl(image.key)}
          alt={image.alt}
          className="max-h-[60svh] w-full rounded-lg object-contain"
        />
      )}
    </div>
  );
}
