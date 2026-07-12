"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import type { Survey, UpdateSurveyRequest } from "@/app/types/survey";
import { useUpdateSurvey } from "@/app/hooks/survey";
import { validateSurveyForSave } from "@/app/lib/survey/builder-validation";
import { useAutosave } from "@/app/hooks/use-autosave";
import { collabEnabled } from "@/app/lib/collab/provider";
import { BuilderProvider, useBuilder } from "./builder-context";
import { BuilderHeader } from "./builder-header";
import { QuestionCard } from "./question-card";
import { AddQuestionButton } from "./add-question-button";
import { PageTabs } from "./page-tabs";
import { BuilderSettings } from "./builder-settings";
import { SurveyPlayer } from "@/app/components/survey-player/survey-player";
import { useTranslation } from "@/app/i18n/context";

function toUpdateRequest(survey: Survey): UpdateSurveyRequest {
  return {
    title: survey.title,
    description: survey.description,
    status: survey.status,
    settings: survey.settings,
    questions: survey.questions,
    sections: survey.sections,
    languages: survey.languages,
    defaultLanguage: survey.defaultLanguage,
    i18n: survey.i18n,
  };
}

interface BuilderInnerProps {
  surveyId: string;
  save?: (req: UpdateSurveyRequest) => Promise<Survey>;
  ownerActions: boolean;
}

function BuilderInner({ surveyId, save, ownerActions }: BuilderInnerProps) {
  const { t } = useTranslation();
  const { survey, markSaved, reorderQuestions, locallyDirty, ready, activePageId, setAttemptedSave } =
    useBuilder();
  const pageQuestions = survey.questions.filter(
    (q) => (q.sectionId ?? null) === activePageId,
  );
  const updateSurvey = useUpdateSurvey(surveyId);
  const [savingOverride, setSavingOverride] = useState(false);

  // One save path for both owner (REST) and passwordless collab (slug), shared
  // by the manual button and autosave; always reconciles state via markSaved.
  const persist = useCallback(
    async (req: UpdateSurveyRequest): Promise<Survey> => {
      const saved = save ? await save(req) : await updateSurvey.mutateAsync(req);
      markSaved(saved);
      return saved;
    },
    [save, updateSurvey, markSaved],
  );

  // Debounced autosave keeps live co-editing durable without a manual Save (#85).
  const { isAutosaving, flush } = useAutosave({
    enabled: collabEnabled(),
    ready,
    locallyDirty,
    survey,
    save: persist,
    toRequest: toUpdateRequest,
  });

  // Persist immediately when the tab is hidden/closed so in-flight edits aren't
  // lost if every collaborator leaves before the debounce fires.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [flush]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderQuestions(String(active.id), String(over.id));
    }
  }

  async function handleSave() {
    // Validate locally first so the author sees exactly what's missing instead
    // of an opaque backend 422. Drafts may be saved incomplete; question/option
    // completeness is only required when publishing (matches the backend).
    const issues = validateSurveyForSave(survey, t, survey.status === "published");
    if (issues.length > 0) {
      setAttemptedSave(true);
      toast.error(t("builder.validation.title", { count: String(issues.length) }), {
        description: issues.map((i) => `• ${i.message}`).join("\n"),
      });
      // Jump to the first problem question so the highlight is visible.
      const firstQuestionId = issues.find((i) => i.questionId)?.questionId;
      if (firstQuestionId) {
        document
          .querySelector(`[data-question-id="${CSS.escape(firstQuestionId)}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    try {
      setSavingOverride(true);
      await persist(toUpdateRequest(survey));
      setAttemptedSave(false);
      toast.success(t("builder.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("builder.saveFailed"));
    } finally {
      setSavingOverride(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <BuilderHeader
        onSave={handleSave}
        isSaving={
          (save ? savingOverride : updateSurvey.isPending) || isAutosaving
        }
        ownerActions={ownerActions}
      />

      <Tabs defaultValue="edit" className="mt-6">
        <TabsList>
          <TabsTrigger value="edit">{t("builder.tab.edit")}</TabsTrigger>
          <TabsTrigger value="preview">{t("builder.tab.preview")}</TabsTrigger>
          <TabsTrigger value="settings">{t("builder.tab.settings")}</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="grid gap-4">
          <PageTabs />
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={pageQuestions.map((q) => q.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="grid gap-4">
                {pageQuestions.map((question, index) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    index={index}
                    total={pageQuestions.length}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <AddQuestionButton />
        </TabsContent>

        <TabsContent value="preview">
          <SurveyPlayer survey={survey} preview />
        </TabsContent>

        <TabsContent value="settings">
          <BuilderSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function SurveyBuilder({
  survey,
  save,
  ownerActions = true,
}: {
  survey: Survey;
  /** Override the owner save (e.g. passwordless collab edit via slug, #22). */
  save?: (req: UpdateSurveyRequest) => Promise<Survey>;
  ownerActions?: boolean;
}) {
  return (
    <BuilderProvider initialSurvey={survey}>
      <BuilderInner surveyId={survey.id} save={save} ownerActions={ownerActions} />
    </BuilderProvider>
  );
}
