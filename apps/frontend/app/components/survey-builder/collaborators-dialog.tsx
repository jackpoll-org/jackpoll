"use client";

import { useState } from "react";
import { Users, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import { Spinner } from "@/app/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import {
  useAddCollaborator,
  useCollaborators,
  useRemoveCollaborator,
} from "@/app/hooks/survey";
import type { CollaboratorRole } from "@/app/types/survey";
import { useTranslation } from "@/app/i18n/context";
import { EditLinkCard } from "./edit-link-card";

export function CollaboratorsDialog({ surveyId }: { surveyId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CollaboratorRole>("editor");

  const collaborators = useCollaborators(open ? surveyId : undefined);
  const addCollaborator = useAddCollaborator(surveyId);
  const removeCollaborator = useRemoveCollaborator(surveyId);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      await addCollaborator.mutateAsync({ email: email.trim(), role });
      setEmail("");
      toast.success(t("collaborators.added"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("collaborators.addFailed"));
    }
  }

  async function handleRemove(userId: string) {
    try {
      await removeCollaborator.mutateAsync(userId);
      toast.success(t("collaborators.removed"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("collaborators.removeFailed"));
    }
  }

  const list = collaborators.data ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Users className="size-4" />
          {t("collaborators.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("collaborators.title")}</DialogTitle>
          <DialogDescription>
            {t("collaborators.description")}
          </DialogDescription>
        </DialogHeader>

        <EditLinkCard surveyId={surveyId} />

        <form onSubmit={handleAdd} className="flex items-end gap-2">
          <div className="grid flex-1 gap-1">
            <Input
              type="email"
              placeholder="person@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Select value={role} onValueChange={(v) => setRole(v as CollaboratorRole)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="editor">{t("collaborators.roleEditor")}</SelectItem>
              <SelectItem value="viewer">{t("collaborators.roleViewer")}</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" disabled={addCollaborator.isPending}>
            {addCollaborator.isPending && <Spinner className="size-4" />}
            {t("common.add")}
          </Button>
        </form>

        <div className="grid gap-2">
          {collaborators.isLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          ) : list.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("collaborators.empty")}
            </p>
          ) : (
            list.map((c) => (
              <div
                key={c.userId}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.name ?? c.email}</p>
                  {c.name && c.email && (
                    <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {c.status === "PENDING" && (
                    <Badge variant="outline">{t("collaborators.pending")}</Badge>
                  )}
                  <Badge variant="secondary" className="capitalize">
                    {c.role}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("collaborators.remove", { who: c.email ?? c.userId })}
                    onClick={() => handleRemove(c.userId)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
