"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import { wordcloudConfig } from "../editors/wordcloud-editor";
import type { QuestionPreviewProps } from "../types";
import { useTranslation } from "@/app/i18n/context";

/** Collapse surrounding + repeated whitespace in a submitted word. */
function normalize(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/**
 * Preview / answer renderer for wordcloud questions. Respondents add up to
 * `maxWords` short words.
 *
 * Two modes:
 *  - Instant (player, `onInstantSubmit` set): each word is sent live as its own
 *    response the moment it's entered; the remaining counter ticks down to 0.
 *  - Batch (builder preview / edit, `onChange` set): words are collected as
 *    removable chips and stored in the answer as string[].
 */
export function WordcloudPreview({
  question,
  value,
  onChange,
  onInstantSubmit,
  disabled,
}: QuestionPreviewProps) {
  const { t } = useTranslation();
  const { maxWords } = wordcloudConfig(question.settings);
  const instant = !!onInstantSubmit;

  // Batch mode reads/writes the answer array; instant mode tracks what it sent.
  const batchWords = Array.isArray(value) ? (value as string[]) : [];
  const [sentWords, setSentWords] = useState<string[]>([]);
  const words = instant ? sentWords : batchWords;

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const interactive = (instant || !!onChange) && !disabled;
  const full = words.length >= maxWords;

  async function addWord(raw: string) {
    const word = normalize(raw);
    if (!word || full || busy) return;
    // Dedupe case-insensitively within this respondent's submission.
    if (words.some((w) => w.toLowerCase() === word.toLowerCase())) {
      setDraft("");
      return;
    }

    if (instant && onInstantSubmit) {
      setBusy(true);
      try {
        await onInstantSubmit([word]);
        setSentWords((prev) => [...prev, word]);
        setDraft("");
      } catch {
        // Keep the word in the box so the respondent can retry.
        toast.error(t("wordcloud.sendFailed"));
      } finally {
        setBusy(false);
      }
      return;
    }

    onChange?.([...batchWords, word]);
    setDraft("");
  }

  function removeWord(index: number) {
    // Sent words can't be unsent; only batch chips are removable.
    if (instant || !onChange) return;
    onChange(batchWords.filter((_, i) => i !== index));
  }

  return (
    <div className="grid gap-2">
      {words.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {words.map((word, i) => (
            <Badge key={`${word}-${i}`} variant="secondary" className="gap-1">
              {instant && <Check className="size-3 text-green-600" />}
              <span className="break-words">{word}</span>
              {!instant && interactive && (
                <button
                  type="button"
                  aria-label={t("wordcloud.removeWord", { word })}
                  className="-mr-1 rounded-sm opacity-70 hover:opacity-100"
                  onClick={() => removeWord(i)}
                >
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {interactive && !full && (
        <Input
          value={draft}
          disabled={busy}
          placeholder={t("wordcloud.addWord")}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              void addWord(draft);
            }
          }}
          // Batch mode commits a half-typed word on blur; instant mode only
          // sends on an explicit Enter so a stray blur never fires a response.
          onBlur={instant ? undefined : () => void addWord(draft)}
        />
      )}

      {interactive && (
        <p className="text-xs text-muted-foreground tabular-nums">
          {full
            ? t("wordcloud.allUsed")
            : t("wordcloud.remaining", {
                count: String(Math.max(0, maxWords - words.length)),
              })}
        </p>
      )}
    </div>
  );
}
