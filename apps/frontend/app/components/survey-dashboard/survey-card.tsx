"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { BarChart3, Copy, GripVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
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
import { useDeleteSurvey, useDuplicateSurvey } from "@/app/hooks/survey";
import { Spinner } from "@/app/components/ui/spinner";
import { OrganizeDialog } from "./organize-dialog";
import { useTranslation } from "@/app/i18n/context";
import type { ListView } from "@/app/lib/preferences/ui-prefs";
import type { Survey, SurveyStatus } from "@/app/types/survey";

const STATUS_VARIANT: Record<
  SurveyStatus,
  "default" | "secondary" | "outline"
> = {
  draft: "secondary",
  published: "default",
  closed: "outline",
};

interface SurveyCardProps {
  survey: Survey;
  onTagClick?: (tag: string) => void;
  /** Display mode (issue #94). Defaults to the card grid. */
  view?: ListView;
  /** A survey shared with me by another owner — read-mostly, no owner actions
   *  (delete/organize/duplicate) and not draggable into my folders (#8). */
  shared?: boolean;
}

export function SurveyCard({ survey, onTagClick, view = "grid", shared = false }: SurveyCardProps) {
  const router = useRouter();
  const { t, tPlural } = useTranslation();
  const deleteSurvey = useDeleteSurvey();
  const duplicateSurvey = useDuplicateSurvey();
  // Sortable so the card can be reordered among its peers AND dropped onto a
  // folder tile (#94). Drag is gated to an explicit grip handle so the card
  // body still scrolls and taps still open the survey on touch devices.
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    isDragging,
    transform,
    transition,
  } = useSortable({ id: survey.id, disabled: shared });
  const dragStyle: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  // Grip handle — the only drag activator (hidden for shared/read-only cards).
  const dragHandle = shared ? null : (
    <button
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={t("card.dragHandle", { title: survey.title })}
      className="relative z-10 flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
    >
      <GripVertical className="size-4" />
    </button>
  );

  async function handleDuplicate() {
    try {
      const copy = await duplicateSurvey.mutateAsync(survey);
      toast.success(t("card.duplicated"));
      router.push(`/surveys/${copy.id}/edit`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("card.duplicateFailed"));
    }
  }

  async function handleDelete() {
    try {
      await deleteSurvey.mutateAsync(survey.id);
      toast.success(t("card.deleted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("card.deleteFailed"));
    }
  }

  const questionCount = survey.questions?.length ?? 0;

  // A survey shared with me: only the results shortcut, no owner-only actions.
  const actions = shared ? (
    <div className="relative z-10 flex items-center gap-1">
      <Button
        asChild
        variant="ghost"
        size="icon"
        aria-label={t("card.viewResults", { title: survey.title })}
        className="text-muted-foreground hover:text-foreground"
      >
        <Link href={`/surveys/${survey.id}/results`}>
          <BarChart3 className="size-4" />
        </Link>
      </Button>
    </div>
  ) : (
    <div className="relative z-10 flex items-center gap-1">
      <OrganizeDialog survey={survey} />
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("card.duplicate", { title: survey.title })}
        onClick={handleDuplicate}
        disabled={duplicateSurvey.isPending}
        className="text-muted-foreground hover:text-foreground"
      >
        {duplicateSurvey.isPending ? (
          <Spinner className="size-4" />
        ) : (
          <Copy className="size-4" />
        )}
      </Button>
      <Button
        asChild
        variant="ghost"
        size="icon"
        aria-label={t("card.viewResults", { title: survey.title })}
        className="text-muted-foreground hover:text-foreground"
      >
        <Link href={`/surveys/${survey.id}/results`}>
          <BarChart3 className="size-4" />
        </Link>
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("card.delete", { title: survey.title })}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("card.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("card.deleteConfirmBody", { title: survey.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  const editLink = (
    <Link
      href={`/surveys/${survey.id}/edit`}
      className="hover:underline before:absolute before:inset-0 before:rounded-xl"
    >
      {survey.title}
    </Link>
  );

  const statusBadge = (
    <span className="flex flex-wrap items-center justify-end gap-1">
      {shared && (
        <Badge variant="outline" className="shrink-0">
          {t("dashboard.shared.badge")}
        </Badge>
      )}
      <Badge variant={STATUS_VARIANT[survey.status]} className="shrink-0 capitalize">
        {survey.status}
      </Badge>
    </span>
  );

  if (view === "list") {
    return (
      <Card
        ref={setNodeRef}
        style={dragStyle}
        className={cn(
          "relative transition-colors hover:border-primary/50",
          isDragging && "opacity-40",
        )}
      >
        <div className="flex flex-wrap items-center gap-3 p-3">
          {dragHandle}
          <div className="min-w-40 flex-1">
            <CardTitle className="truncate text-base">{editLink}</CardTitle>
          </div>
          <span className="shrink-0 text-sm text-muted-foreground">
            {tPlural("card.questionCount", questionCount)}
          </span>
          {statusBadge}
          {actions}
        </div>
      </Card>
    );
  }

  return (
    <Card
      ref={setNodeRef}
      style={dragStyle}
      className={cn(
        "relative transition-colors hover:border-primary/50",
        isDragging && "opacity-40",
      )}
    >
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          {/* min-w-40, not min-w-0: the title may shrink, but not below a
              readable width — the row wraps the badge instead. */}
          <div className="min-w-40 flex-1">
            {/* Stretched link: covers the whole card so clicking anywhere
                opens the builder. Interactive controls below sit on a higher
                stacking layer (relative z-10) so they aren't hijacked. */}
            <CardTitle className="truncate">{editLink}</CardTitle>
            {survey.description && (
              <CardDescription className="mt-1 line-clamp-2">
                {survey.description}
              </CardDescription>
            )}
          </div>
          <div className="flex max-w-full flex-wrap items-start justify-end gap-1">
            {statusBadge}
            {dragHandle}
          </div>
        </div>

        {survey.tags && survey.tags.length > 0 && (
          <div className="relative z-10 mt-2 flex flex-wrap gap-1">
            {survey.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="cursor-pointer hover:bg-accent"
                onClick={() => onTagClick?.(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{tPlural("card.questionCount", questionCount)}</span>
          {actions}
        </div>
      </CardHeader>
    </Card>
  );
}
