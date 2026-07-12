"use client";

import { Check, Mail, X } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Spinner } from "@/app/components/ui/spinner";
import {
  useAcceptInvitation,
  useDeclineInvitation,
  useInvitations,
} from "@/app/hooks/survey";
import { useTranslation } from "@/app/i18n/context";

/**
 * Pending collaboration invitations on the dashboard (#8). Accepting moves the
 * survey into "Shared with me"; declining removes the invite. Works the same in
 * the web app and the native app.
 */
export function InvitationsBanner() {
  const { t } = useTranslation();
  const invitations = useInvitations();
  const accept = useAcceptInvitation();
  const decline = useDeclineInvitation();
  const list = invitations.data ?? [];

  if (list.length === 0) return null;

  async function onAccept(surveyId: string, title: string) {
    try {
      await accept.mutateAsync(surveyId);
      toast.success(t("invitations.accepted", { title }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("invitations.actionFailed"));
    }
  }

  async function onDecline(surveyId: string) {
    try {
      await decline.mutateAsync(surveyId);
      toast.success(t("invitations.declined"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("invitations.actionFailed"));
    }
  }

  const pending = accept.isPending || decline.isPending;

  return (
    <Card className="mb-4 border-primary/40 bg-primary/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Mail className="size-4 text-primary" />
        <span className="text-sm font-medium">{t("invitations.title")}</span>
        <Badge variant="secondary" className="ml-auto tabular-nums">
          {list.length}
        </Badge>
      </div>
      <ul className="grid gap-2">
        {list.map((inv) => (
          <li
            key={inv.surveyId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{inv.surveyTitle}</p>
              <p className="truncate text-xs text-muted-foreground">
                {t("invitations.from", {
                  who: inv.ownerName ?? t("invitations.someone"),
                  role: t(
                    inv.role === "editor"
                      ? "collaborators.roleEditor"
                      : "collaborators.roleViewer",
                  ),
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={pending}
                onClick={() => onAccept(inv.surveyId, inv.surveyTitle)}
              >
                {accept.isPending ? (
                  <Spinner className="size-4" />
                ) : (
                  <Check className="size-4" />
                )}
                {t("invitations.accept")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => onDecline(inv.surveyId)}
              >
                <X className="size-4" />
                {t("invitations.decline")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
