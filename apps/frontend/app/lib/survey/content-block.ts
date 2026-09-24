import type { Question, QuestionType } from "@/app/types/survey";

/**
 * False for display-only blocks (content, public #7) that never collect an
 * answer: skip them wherever answers are validated, listed, exported or scored.
 */
export function isAnswerable(type: QuestionType): boolean {
  return type !== "content";
}

/** Image attached to a content block (public #7), stored in question.settings.image. */
export interface ContentImage {
  /** Upload object key — rendered via uploadFileUrl, never a remote URL. */
  key: string;
  alt: string;
}

/** Read a content block's image from its settings, ignoring malformed values. */
export function getContentImage(question: Question): ContentImage | null {
  const raw = question.settings?.image;
  if (!raw || typeof raw !== "object") return null;
  const { key, alt } = raw as Partial<ContentImage>;
  if (typeof key !== "string" || !key) return null;
  return { key, alt: typeof alt === "string" ? alt : "" };
}
