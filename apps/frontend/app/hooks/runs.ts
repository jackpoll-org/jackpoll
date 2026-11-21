"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  closeRunApi,
  createRunApi,
  deleteRunApi,
  duplicateRunApi,
  listRunsApi,
  updateRunApi,
} from "@/app/lib/survey/api";
import { surveyKeys } from "@/app/lib/survey/constants";
import { localizeServerError } from "@/app/i18n/server-errors";
import type { ApiResponse } from "@/app/types/auth";
import type { Run, RunRequest } from "@/app/types/survey";

function unwrap<T>(res: ApiResponse<T>, fallback: string): T {
  if (!res.success || !res.data) throw new Error(localizeServerError(res.error ?? fallback));
  return res.data;
}

export function useRuns(surveyId: string, enabled = true) {
  return useQuery({
    queryKey: surveyKeys.runs(surveyId),
    queryFn: async () => unwrap(await listRunsApi(surveyId), "Failed to load runs"),
    enabled,
  });
}

function useRunMutation<V>(surveyId: string, fn: (vars: V) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: surveyKeys.runs(surveyId) });
      queryClient.invalidateQueries({ queryKey: surveyKeys.liveSessions(surveyId) });
    },
  });
}

export function useCreateRun(surveyId: string) {
  return useRunMutation(surveyId, async (data: RunRequest): Promise<Run> =>
    unwrap(await createRunApi(surveyId, data), "Failed to create run"),
  );
}

export function useUpdateRun(surveyId: string) {
  return useRunMutation(surveyId, async ({ id, data }: { id: string; data: RunRequest }) =>
    unwrap(await updateRunApi(surveyId, id, data), "Failed to update run"),
  );
}

export function useCloseRun(surveyId: string) {
  return useRunMutation(surveyId, async (id: string) =>
    unwrap(await closeRunApi(surveyId, id), "Failed to close run"),
  );
}

export function useDuplicateRun(surveyId: string) {
  return useRunMutation(surveyId, async ({ id, data }: { id: string; data: RunRequest }) =>
    unwrap(await duplicateRunApi(surveyId, id, data), "Failed to duplicate run"),
  );
}

export function useDeleteRun(surveyId: string) {
  return useRunMutation(surveyId, async (id: string) => {
    const res = await deleteRunApi(surveyId, id);
    if (!res.success) throw new Error(localizeServerError(res.error ?? "Failed to delete run"));
  });
}
