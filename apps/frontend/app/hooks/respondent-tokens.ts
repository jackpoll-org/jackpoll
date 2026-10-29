"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addRespondentTokensApi,
  deleteRespondentTokenApi,
  generateRespondentTokensApi,
  listRespondentTokensApi,
} from "@/app/lib/survey/api";
import { surveyKeys } from "@/app/lib/survey/constants";
import { localizeServerError } from "@/app/i18n/server-errors";
import type { ApiResponse } from "@/app/types/auth";
import type { RespondentToken } from "@/app/types/survey";

function unwrap(res: ApiResponse<RespondentToken[]>, fallback: string): RespondentToken[] {
  if (!res.success || !res.data) throw new Error(localizeServerError(res.error ?? fallback));
  return res.data;
}

export function useRespondentTokens(surveyId: string) {
  return useQuery({
    queryKey: surveyKeys.respondentTokens(surveyId),
    queryFn: async () => unwrap(await listRespondentTokensApi(surveyId), "Failed to load tokens"),
  });
}

export function useAddRespondentTokens(surveyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { count: number } | { tokens: string[] }) =>
      unwrap(
        "count" in input
          ? await generateRespondentTokensApi(surveyId, input.count)
          : await addRespondentTokensApi(surveyId, input.tokens),
        "Failed to add tokens",
      ),
    onSuccess: (data) => queryClient.setQueryData(surveyKeys.respondentTokens(surveyId), data),
  });
}

export function useDeleteRespondentToken(surveyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tokenId?: string) => {
      const res = await deleteRespondentTokenApi(surveyId, tokenId);
      if (!res.success) throw new Error(localizeServerError(res.error ?? "Failed to remove token"));
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: surveyKeys.respondentTokens(surveyId) }),
  });
}
