"use client";

import { useState } from "react";
import { Check, Copy, Send, Trash2, Webhook as WebhookIcon } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Spinner } from "@/app/components/ui/spinner";
import {
  useCreateWebhook,
  useDeleteWebhook,
  useTestWebhook,
  useWebhooks,
} from "@/app/hooks/survey";
import { useBuilder } from "./builder-context";
import { useTranslation } from "@/app/i18n/context";
import type { Webhook } from "@/app/types/survey";

function StatusBadge({ hook }: { hook: Webhook }) {
  const { t } = useTranslation();
  if (!hook.lastDeliveryAt) {
    return <Badge variant="outline">{t("integrations.notDelivered")}</Badge>;
  }
  const ok = hook.lastStatus != null && hook.lastStatus < 400;
  return (
    <Badge variant={ok ? "default" : "destructive"} title={hook.lastError ?? undefined}>
      {ok
        ? t("integrations.delivered", { status: String(hook.lastStatus) })
        : hook.lastError ?? t("integrations.failed")}
    </Badge>
  );
}

function SecretField({ secret }: { secret: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(secret);
          setCopied(true);
          toast.success(t("integrations.secretCopied"));
        } catch {
          /* clipboard blocked */
        }
      }}
      className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
      title={t("integrations.copySecret")}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {t("integrations.secretLabel", { prefix: secret.slice(0, 8) })}
    </button>
  );
}

/**
 * Outbound webhooks (issue #36): owners add endpoints that receive an
 * HMAC-signed POST on every new response. Delivery is best-effort and retried.
 */
export function IntegrationsCard() {
  const { t } = useTranslation();
  const { survey } = useBuilder();
  const webhooks = useWebhooks(survey.id);
  const createWebhook = useCreateWebhook(survey.id);
  const deleteWebhook = useDeleteWebhook(survey.id);
  const testWebhook = useTestWebhook(survey.id);
  const [url, setUrl] = useState("");

  async function add() {
    if (!url.trim()) return;
    try {
      await createWebhook.mutateAsync({ url: url.trim(), enabled: true });
      setUrl("");
      toast.success(t("integrations.added"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("integrations.addFailed"));
    }
  }

  async function test(id: string) {
    try {
      const result = await testWebhook.mutateAsync(id);
      if (result.delivered) {
        toast.success(t("integrations.testDelivered", { status: String(result.status) }));
      } else {
        toast.error(
          t("integrations.testFailedReason", {
            reason: result.error ?? t("integrations.noResponse"),
          }),
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("integrations.testFailed"));
    }
  }

  async function remove(id: string) {
    try {
      await deleteWebhook.mutateAsync(id);
      toast.success(t("integrations.removed"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("integrations.removeFailed"));
    }
  }

  const list = webhooks.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <WebhookIcon className="size-4" />
          {t("integrations.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-xs text-muted-foreground">
          {t("integrations.descriptionBefore")}{" "}
          <code>X-Survey-Signature</code> {t("integrations.descriptionAfter")}
        </p>

        <div className="flex items-center gap-2">
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="https://example.com/webhooks/survey"
          />
          <Button type="button" onClick={add} disabled={createWebhook.isPending}>
            {createWebhook.isPending && <Spinner className="size-4" />}
            {t("common.add")}
          </Button>
        </div>

        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("integrations.empty")}</p>
        ) : (
          <ul className="grid gap-2">
            {list.map((hook) => (
              <li
                key={hook.id}
                className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div className="min-w-0 grid gap-1">
                  <span className="truncate text-sm font-medium">{hook.url}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge hook={hook} />
                    <SecretField secret={hook.secret} />
                  </div>
                </div>
                <div className="flex items-center gap-1 justify-self-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => test(hook.id)}
                    disabled={testWebhook.isPending}
                  >
                    <Send className="size-4" />
                    {t("integrations.test")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("integrations.deleteAria")}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => remove(hook.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
