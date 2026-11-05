"use client";

import { useState } from "react";
import { Copy, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/app/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/app/components/ui/alert";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Switch } from "@/app/components/ui/switch";
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from "@/app/hooks/survey";
import { useTranslation } from "@/app/i18n/context";
import type { ApiKey } from "@/app/types/api-key";

const MAX_NAME_LENGTH = 100;

export function ApiKeysCard() {
  const { t } = useTranslation();
  const keys = useApiKeys();
  const create = useCreateApiKey();
  const [name, setName] = useState("");
  const [readResponses, setReadResponses] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const apiBase = typeof window === "undefined" ? "/api" : `${window.location.origin}/api`;

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), readResponses },
      {
        onSuccess: (created) => {
          setSecret(created.secret);
          setName("");
          setReadResponses(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : t("settings.apiKeys.createFailed")),
      },
    );
  }

  function copySecret() {
    if (!secret) return;
    void navigator.clipboard
      .writeText(secret)
      .then(() => toast.success(t("settings.apiKeys.copied")))
      .catch(() => toast.error(t("settings.apiKeys.copyFailed")));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("settings.apiKeys.title")}</CardTitle>
        <CardDescription>
          {t("settings.apiKeys.description", { base: apiBase, spec: `${apiBase}/openapi` })}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {secret && (
          <Alert>
            <KeyRound className="size-4" />
            <AlertTitle>{t("settings.apiKeys.newKeyTitle")}</AlertTitle>
            <AlertDescription className="grid gap-2">
              <p>{t("settings.apiKeys.newKeyHint")}</p>
              <code className="break-all rounded bg-muted px-2 py-1 font-mono text-xs text-foreground">
                {secret}
              </code>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copySecret}>
                  <Copy className="size-4" /> {t("settings.apiKeys.copy")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSecret(null);
                    create.reset();
                  }}
                >
                  {t("settings.apiKeys.done")}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <form className="grid gap-3" onSubmit={handleCreate}>
          <div className="grid gap-1">
            <Label htmlFor="api-key-name">{t("settings.apiKeys.name")}</Label>
            <Input
              id="api-key-name"
              maxLength={MAX_NAME_LENGTH}
              placeholder={t("settings.apiKeys.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="api-key-responses" checked={readResponses} onCheckedChange={setReadResponses} />
            <Label htmlFor="api-key-responses" className="font-normal">
              {t("settings.apiKeys.readResponses")}
            </Label>
          </div>
          <Button type="submit" className="w-fit" disabled={!name.trim() || create.isPending}>
            {t("settings.apiKeys.create")}
          </Button>
        </form>

        {(keys.data ?? []).length > 0 && (
          <ul className="grid gap-2">
            {keys.data!.map((key) => (
              <ApiKeyRow key={key.id} apiKey={key} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ApiKeyRow({ apiKey }: { apiKey: ApiKey }) {
  const { t } = useTranslation();
  const remove = useDeleteApiKey();

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
      <div className="grid min-w-0 gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{apiKey.name}</span>
          <code className="font-mono text-xs text-muted-foreground">{apiKey.prefix}…</code>
          {apiKey.scopes.map((scope) => (
            <Badge key={scope} variant="secondary">
              {t(scope === "responses" ? "settings.apiKeys.scopeResponses" : "settings.apiKeys.scopeSurveys")}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("settings.apiKeys.created", { date: new Date(apiKey.createdAt).toLocaleDateString() })}
          {" · "}
          {apiKey.lastUsedAt
            ? t("settings.apiKeys.lastUsed", { date: new Date(apiKey.lastUsedAt).toLocaleString() })
            : t("settings.apiKeys.neverUsed")}
        </p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("settings.apiKeys.revoke")}>
            <Trash2 className="size-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.apiKeys.revokeTitle", { name: apiKey.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t("settings.apiKeys.revokeDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                remove.mutate(apiKey.id, {
                  onError: (err) =>
                    toast.error(err instanceof Error ? err.message : t("settings.apiKeys.revokeFailed")),
                })
              }
            >
              {t("settings.apiKeys.revoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
