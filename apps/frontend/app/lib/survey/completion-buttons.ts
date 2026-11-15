import type { CompletionButton } from "@/app/types/survey";

export const MAX_COMPLETION_BUTTONS = 10;
export const MAX_BUTTON_LABEL = 80;
export const MAX_BUTTON_URL = 2048;

const HTTP_URL =
  /^https?:\/\/(?:[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*|\[[0-9a-f:.]+\])(?::[0-9]{1,5})?(?:[/?#]\S*)?$/iu;

export function safeButtonUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value || value.length > MAX_BUTTON_URL) return null;
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  if (!HTTP_URL.test(candidate)) return null;
  try {
    return new URL(candidate).toString();
  } catch {
    return null;
  }
}

export function isButtonComplete(button: CompletionButton): boolean {
  return !!button.label?.trim() && (button.action !== "url" || !!safeButtonUrl(button.url));
}
