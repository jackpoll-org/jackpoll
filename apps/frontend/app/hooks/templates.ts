"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

function toTemplate(dto: CustomTemplateDto): SurveyTemplate {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? "",
    category: "custom",
    source: "custom",
    settings: dto.settings ?? undefined,
    questions: dto.questions ?? [],
  };
}

export function useCustomTemplates() {
  return useQuery({
    queryKey: templatesKey,
    queryFn: async () => {
      const res = await listTemplatesApi();
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to load templates");
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
        throw new Error(res.error ?? "Failed to save template");
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
        throw new Error(res.error ?? "Failed to delete template");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templatesKey });
    },
  });
}
