"use client";

import { useState } from "react";
import { Copy, Download, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Spinner } from "@/app/components/ui/spinner";
import { Textarea } from "@/app/components/ui/textarea";
import {
  useAddRespondentTokens,
  useDeleteRespondentToken,
  useRespondentTokens,
} from "@/app/hooks/respondent-tokens";
import { useShareLink } from "@/app/hooks/survey";
import { buildTokensCsv, downloadText, parseTokenList } from "@/app/lib/survey/export";
import { useTranslation } from "@/app/i18n/context";

interface RespondentTokensCardProps {
  surveyId: string;
  isPublished: boolean;
}

export function RespondentTokensCard({ surveyId, isPublished }: RespondentTokensCardProps) {
  const { t } = useTranslation();
  const tokens = useRespondentTokens(surveyId);
  const add = useAddRespondentTokens(surveyId);
  const remove = useDeleteRespondentToken(surveyId);
  const shareLink = useShareLink(surveyId, isPublished);
  const [count, setCount] = useState(10);
  const [allowlist, setAllowlist] = useState("");
  const list = tokens.data ?? [];
  const used = list.filter((tk) => tk.usedAt).length;
  const slug = shareLink.data?.slug;

  function linkFor(token: string): string {
    return slug ? `${window.location.origin}/s/${slug}?token=${encodeURIComponent(token)}` : "";
  }

  async function addTokens(input: { count: number } | { tokens: string[] }) {
    try {
      await add.mutateAsync(input);
      toast.success(t("builder.tokens.added"));
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.updateFailed"));
      return false;
    }
  }

  async function addAllowlist(text: string) {
    const parsed = parseTokenList(text);
    if (parsed.length > 0 && (await addTokens({ tokens: parsed }))) setAllowlist("");
  }

  async function removeToken(id?: string) {
    if (!id && !window.confirm(t("builder.tokens.removeAllConfirm"))) return;
    try {
      await remove.mutateAsync(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.updateFailed"));
    }
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(list.map((tk) => tk.token).join("\n"));
      toast.success(t("builder.tokens.copied"));
    } catch {
      toast.error(t("common.copyFailed"));
    }
  }

  return (
    <div className="grid gap-4 rounded-md border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="token-count">{t("builder.tokens.count")}</Label>
          <Input
            id="token-count"
            type="number"
            min={1}
            max={1000}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-28"
          />
        </div>
        <Button
          variant="outline"
          disabled={add.isPending || count < 1 || count > 1000}
          onClick={() => addTokens({ count })}
        >
          {t("builder.tokens.generate")}
        </Button>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="token-allowlist">{t("builder.tokens.allowlist")}</Label>
        <Textarea
          id="token-allowlist"
          rows={3}
          value={allowlist}
          onChange={(e) => setAllowlist(e.target.value)}
          placeholder={t("builder.tokens.allowlistPlaceholder")}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={add.isPending || !allowlist.trim()}
            onClick={() => addAllowlist(allowlist)}
          >
            {t("builder.tokens.add")}
          </Button>
          <Button variant="outline" asChild>
            <label>
              <Upload className="size-4" />
              {t("builder.tokens.upload")}
              <input
                type="file"
                accept=".txt,.csv,text/plain,text/csv"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) await addAllowlist(await file.text());
                }}
              />
            </label>
          </Button>
        </div>
      </div>

      {tokens.isLoading ? (
        <Spinner className="size-5" />
      ) : list.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("builder.tokens.empty")}</p>
      ) : (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              {t("builder.tokens.summary", { used: String(used), total: String(list.length) })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={copyAll}>
                <Copy className="size-4" />
                {t("builder.tokens.copyAll")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  downloadText("tokens.csv", buildTokensCsv(list, linkFor), "text/csv;charset=utf-8")
                }
              >
                <Download className="size-4" />
                {t("builder.tokens.download")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => removeToken()}>
                <Trash2 className="size-4" />
                {t("builder.tokens.removeAll")}
              </Button>
            </div>
          </div>
          {!isPublished && (
            <p className="text-xs text-muted-foreground">{t("builder.tokens.publishForLinks")}</p>
          )}
          <ul className="grid max-h-64 gap-1 overflow-y-auto">
            {list.map((tk) => (
              <li key={tk.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-mono">{tk.token}</span>
                <span className="flex items-center gap-1">
                  <Badge variant={tk.usedAt ? "secondary" : "outline"}>
                    {tk.usedAt ? t("builder.tokens.used") : t("builder.tokens.unused")}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t("builder.tokens.remove")}
                    onClick={() => removeToken(tk.id)}
                  >
                    <X className="size-4" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
