"use client";

import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCreateSurvey, useDeleteSurvey } from "@/app/hooks/survey";
import { updateSurveyApi } from "@/app/lib/survey/api";
import { instantiateTemplate } from "@/app/lib/survey/templates";
import { useTranslation } from "@/app/i18n/context";
import {
  createTemplateApi,
  deleteTemplateApi,
  listTemplatesApi,
} from "@/app/lib/survey/templates/api";
import { templatesKey } from "@/app/lib/survey/constants";
import type {
  CreateTemplateInput,
  CustomTemplateDto,
  SurveyTemplate,
} from "@/app/lib/survey/templates/types";
import { localizeServerError } from "@/app/i18n/server-errors";

function toTemplate(dto: CustomTemplateDto): SurveyTemplate {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? "",
    category: "custom",
    source: "custom",
    settings: dto.settings ?? undefined,
    questions: dto.questions ?? [],
    sections: Array.isArray(dto.sections) ? dto.sections : [],
  };
}

export function useCustomTemplates() {
  return useQuery({
    queryKey: templatesKey,
    queryFn: async () => {
      const res = await listTemplatesApi();
      if (!res.success || !res.data) {
        throw new Error(localizeServerError(res.error ?? "Failed to load templates"));
      }
      return res.data.map(toTemplate);
    },
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateTemplateInput) => {
      const res = await createTemplateApi(data);
      if (!res.success || !res.data) {
        throw new Error(localizeServerError(res.error ?? "Failed to save template"));
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templatesKey });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteTemplateApi(id);
      if (!res.success) {
        throw new Error(localizeServerError(res.error ?? "Failed to delete template"));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templatesKey });
    },
  });
}

const START_FROM_TEMPLATE_KEY = ["startFromTemplate"];
let startingFromTemplate = false;

export function useStartFromTemplate() {
  const createSurvey = useCreateSurvey();
  const deleteSurvey = useDeleteSurvey();
  const router = useRouter();
  const { t } = useTranslation();
  const isPending = useIsMutating({ mutationKey: START_FROM_TEMPLATE_KEY }) > 0;
  const mutation = useMutation({
    mutationKey: START_FROM_TEMPLATE_KEY,
    mutationFn: async (template: SurveyTemplate) => {
      const survey = await createSurvey.mutateAsync({ title: template.name });
      const discard = () => deleteSurvey.mutateAsync(survey.id).catch(() => undefined);
      let res: Awaited<ReturnType<typeof updateSurveyApi>>;
      try {
        res = await updateSurveyApi(survey.id, {
          title: survey.title,
          description: survey.description,
          status: survey.status,
          settings: { ...survey.settings, ...(template.settings ?? {}) },
          ...instantiateTemplate(template),
        });
      } catch (error) {
        await discard();
        throw error;
      }
      if (!res.success) {
        await discard();
        throw new Error(res.error ? localizeServerError(res.error) : t("templates.applyFailed"));
      }
      return survey.id;
    },
    onSuccess: (id) => router.push(`/surveys/${id}/edit`),
  });

  async function start(template: SurveyTemplate): Promise<boolean> {
    if (startingFromTemplate) return false;
    startingFromTemplate = true;
    try {
      await mutation.mutateAsync(template);
      return true;
    } finally {
      startingFromTemplate = false;
    }
  }

  return { start, isPending };
}
