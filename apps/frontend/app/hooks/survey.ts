"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addCollaboratorApi,
  clearResponsesApi,
  createFolderApi,
  createSurveyApi,
  createWebhookApi,
  deleteDraftApi,
  deleteWebhookApi,
  listWebhooksApi,
  testWebhookApi,
  deleteFolderApi,
  renameFolderApi,
  reorderSurveysApi,
  getNotificationPrefsApi,
  updateNotificationPrefsApi,
  deleteResponseApi,
  deleteSurveyApi,
  editResponseApi,
  getResponseForEditApi,
  getBeginTokenApi,
  getDraftApi,
  listFoldersApi,
  organizeSurveyApi,
  getAccessCodeApi,
  getAnalyticsApi,
  getPublicSurveyApi,
  getCollabLinkApi,
  getLiveResultsApi,
  getResultsApi,
  deletePreviewResponsesApi,
  acceptInvitationApi,
  declineInvitationApi,
  getShareLinkApi,
  getSurveyApi,
  listCollaboratorsApi,
  listInvitationsApi,
  listResponsesApi,
  listSurveysApi,
  removeCollaboratorApi,
  resolveAccessCodeApi,
  resolveCollabApi,
  resolveLinkApi,
  rotateAccessCodeApi,
  rotateCollabLinkApi,
  rotateShareLinkApi,
  saveDraftApi,
  submitResponseApi,
  updateAccessCodeApi,
  updateCollabLinkApi,
  updateShareLinkApi,
  updateSurveyApi,
} from "@/app/lib/survey/api";
import {
  DEFAULT_PAGE_SIZE,
  RESULTS_POLL_INTERVAL_MS,
  foldersKey,
  notificationPrefsKey,
  surveyKeys,
} from "@/app/lib/survey/constants";
import { cloneQuestions } from "@/app/lib/survey/clone";
import type {
  AddCollaboratorRequest,
  CreateSurveyRequest,
  CreateWebhookRequest,
  NotificationPreferences,
  SaveDraftRequest,
  SubmitResponseRequest,
  Survey,
  UpdateShareLinkRequest,
  UpdateSurveyRequest,
} from "@/app/types/survey";

// ── useSurveys (list) ─────────────────────────────────────────────

export function useSurveys(page = 0, limit = DEFAULT_PAGE_SIZE) {
  return useQuery({
    queryKey: surveyKeys.list(page, limit),
    queryFn: async () => {
      const res = await listSurveysApi(page, limit);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to load surveys");
      }
      return { surveys: res.data, meta: res.meta };
    },
  });
}

// ── useSurvey (detail) ────────────────────────────────────────────

export function useSurvey(id: string | undefined) {
  return useQuery({
    queryKey: surveyKeys.detail(id ?? "unknown"),
    queryFn: async () => {
      const res = await getSurveyApi(id!);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to load survey");
      }
      return res.data;
    },
    enabled: !!id,
  });
}

// ── useCreateSurvey ───────────────────────────────────────────────

export function useCreateSurvey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSurveyRequest): Promise<Survey> => {
      const res = await createSurveyApi(data);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to create survey");
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: surveyKeys.lists() });
    },
  });
}

// ── useUpdateSurvey ───────────────────────────────────────────────

export function useUpdateSurvey(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateSurveyRequest): Promise<Survey> => {
      const res = await updateSurveyApi(id, data);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to save survey");
      }
      return res.data;
    },
    onSuccess: (survey) => {
      queryClient.setQueryData(surveyKeys.detail(id), survey);
      queryClient.invalidateQueries({ queryKey: surveyKeys.lists() });
    },
  });
}

// ── useDeleteSurvey ───────────────────────────────────────────────

export function useDeleteSurvey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await deleteSurveyApi(id);
      if (!res.success) {
        throw new Error(res.error ?? "Failed to delete survey");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: surveyKeys.lists() });
    },
  });
}

// ── Organization: tags & folders (issue #33) ─────────────────────

export function useOrganizeSurvey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      tags: string[];
      folderId: string | null;
    }) => {
      const res = await organizeSurveyApi(vars.id, {
        tags: vars.tags,
        folderId: vars.folderId,
      });
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to organize survey");
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: surveyKeys.lists() });
    },
  });
}

/**
 * Persist a manual drag order for one folder/root bucket (issue #94). Patches
 * the cached list optimistically (so the new order sticks instantly) and
 * reconciles with the server on settle.
 */
export function useReorderSurveys() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { folderId: string | null; orderedIds: string[] }) => {
      const res = await reorderSurveysApi(vars.folderId, vars.orderedIds);
      if (!res.success) throw new Error(res.error ?? "Failed to reorder surveys");
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: surveyKeys.lists() });
      const rank = new Map(vars.orderedIds.map((id, i) => [id, i]));
      queryClient.setQueriesData<{ surveys: Survey[]; meta?: unknown }>(
        { queryKey: surveyKeys.lists() },
        (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            surveys: prev.surveys.map((s) =>
              rank.has(s.id) ? { ...s, sortPosition: rank.get(s.id)! } : s,
            ),
          };
        },
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: surveyKeys.lists() });
    },
  });
}

export function useFolders() {
  return useQuery({
    queryKey: foldersKey,
    queryFn: async () => {
      const res = await listFoldersApi();
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to load folders");
      }
      return res.data;
    },
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await createFolderApi(name);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to create folder");
      }
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: foldersKey }),
  });
}

export function useRenameFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; name: string }) => {
      const res = await renameFolderApi(vars.id, vars.name);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to rename folder");
      }
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: foldersKey }),
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteFolderApi(id);
      if (!res.success) throw new Error(res.error ?? "Failed to delete folder");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: foldersKey });
      queryClient.invalidateQueries({ queryKey: surveyKeys.lists() });
    },
  });
}

// ── Notification preferences (issue #89) ──────────────────────────

export function useNotificationPrefs() {
  return useQuery({
    queryKey: notificationPrefsKey,
    queryFn: async () => {
      const res = await getNotificationPrefsApi();
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to load notification preferences");
      }
      return res.data;
    },
  });
}

export function useUpdateNotificationPrefs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: NotificationPreferences) => {
      const res = await updateNotificationPrefsApi(prefs);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to save notification preferences");
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(notificationPrefsKey, data);
    },
  });
}

// ── useDuplicateSurvey (issue #27) ────────────────────────────────

export function useDuplicateSurvey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (source: Survey): Promise<Survey> => {
      const createRes = await createSurveyApi({
        title: `Copy of ${source.title}`,
        description: source.description,
      });
      if (!createRes.success || !createRes.data) {
        throw new Error(createRes.error ?? "Failed to duplicate survey");
      }
      const created = createRes.data;

      const updateRes = await updateSurveyApi(created.id, {
        title: created.title,
        description: created.description,
        status: "draft",
        settings: source.settings,
        questions: cloneQuestions(source.questions),
      });
      if (!updateRes.success || !updateRes.data) {
        throw new Error(updateRes.error ?? "Failed to duplicate survey");
      }
      return updateRes.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: surveyKeys.lists() });
    },
  });
}

// ── Collaborators (issue #8) ──────────────────────────────────────

export function useCollaborators(surveyId: string | undefined) {
  return useQuery({
    queryKey: surveyKeys.collaborators(surveyId ?? "unknown"),
    queryFn: async () => {
      const res = await listCollaboratorsApi(surveyId!);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to load collaborators");
      }
      return res.data;
    },
    enabled: !!surveyId,
  });
}

export function useAddCollaborator(surveyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: AddCollaboratorRequest) => {
      const res = await addCollaboratorApi(surveyId, data);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to add collaborator");
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: surveyKeys.collaborators(surveyId) });
    },
  });
}

export function useRemoveCollaborator(surveyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await removeCollaboratorApi(surveyId, userId);
      if (!res.success) {
        throw new Error(res.error ?? "Failed to remove collaborator");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: surveyKeys.collaborators(surveyId) });
    },
  });
}

// ── Invitations (invitee-facing, issue #8) ────────────────────────

export function useInvitations() {
  return useQuery({
    queryKey: surveyKeys.invitations(),
    queryFn: async () => {
      const res = await listInvitationsApi();
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to load invitations");
      }
      return res.data;
    },
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (surveyId: string) => {
      const res = await acceptInvitationApi(surveyId);
      if (!res.success) throw new Error(res.error ?? "Failed to accept invitation");
    },
    onSuccess: () => {
      // The survey now shows up in "Shared with me".
      queryClient.invalidateQueries({ queryKey: surveyKeys.invitations() });
      queryClient.invalidateQueries({ queryKey: surveyKeys.lists() });
    },
  });
}

export function useDeclineInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (surveyId: string) => {
      const res = await declineInvitationApi(surveyId);
      if (!res.success) throw new Error(res.error ?? "Failed to decline invitation");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: surveyKeys.invitations() });
    },
  });
}

// ── Shareable link (issue #16) ────────────────────────────────────

export function useShareLink(surveyId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: surveyKeys.shareLink(surveyId ?? "unknown"),
    queryFn: async () => {
      const res = await getShareLinkApi(surveyId!);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to load share link");
      }
      return res.data;
    },
    enabled: !!surveyId && enabled,
  });
}

export function useRotateShareLink(surveyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await rotateShareLinkApi(surveyId);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to rotate link");
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(surveyKeys.shareLink(surveyId), data);
    },
  });
}

export function useUpdateShareLink(surveyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateShareLinkRequest) => {
      const res = await updateShareLinkApi(surveyId, data);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to update link");
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(surveyKeys.shareLink(surveyId), data);
    },
  });
}

export function usePublicLink(slug: string | undefined) {
  return useQuery({
    queryKey: surveyKeys.publicLink(slug ?? "unknown"),
    queryFn: async () => {
      const res = await resolveLinkApi(slug!);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "This link is not available.");
      }
      return res.data;
    },
    enabled: !!slug,
    retry: false,
  });
}

// ── Access code (issue #15) ───────────────────────────────────────

export function useAccessCode(surveyId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: surveyKeys.accessCode(surveyId ?? "unknown"),
    queryFn: async () => {
      const res = await getAccessCodeApi(surveyId!);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to load access code");
      }
      return res.data;
    },
    enabled: !!surveyId && enabled,
  });
}

export function useRotateAccessCode(surveyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await rotateAccessCodeApi(surveyId);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to rotate code");
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(surveyKeys.accessCode(surveyId), data);
    },
  });
}

export function useUpdateAccessCode(surveyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requireCode: boolean) => {
      const res = await updateAccessCodeApi(surveyId, requireCode);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to update code");
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(surveyKeys.accessCode(surveyId), data);
    },
  });
}

export function useResolveAccessCode() {
  return useMutation({
    mutationFn: async (code: string) => {
      const res = await resolveAccessCodeApi(code);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Code not found.");
      }
      return res.data;
    },
  });
}

// ── Collaboration edit link (issue #22) ───────────────────────────

export function useCollabLink(surveyId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: surveyKeys.collabLink(surveyId ?? "unknown"),
    queryFn: async () => {
      const res = await getCollabLinkApi(surveyId!);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to load collab link");
      }
      return res.data;
    },
    enabled: !!surveyId && enabled,
  });
}

export function useRotateCollabLink(surveyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await rotateCollabLinkApi(surveyId);
      if (!res.success || !res.data) throw new Error(res.error ?? "Failed to rotate");
      return res.data;
    },
    onSuccess: (data) =>
      queryClient.setQueryData(surveyKeys.collabLink(surveyId), data),
  });
}

export function useUpdateCollabLink(surveyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (expiresAt: string | null) => {
      const res = await updateCollabLinkApi(surveyId, expiresAt);
      if (!res.success || !res.data) throw new Error(res.error ?? "Failed to update");
      return res.data;
    },
    onSuccess: (data) =>
      queryClient.setQueryData(surveyKeys.collabLink(surveyId), data),
  });
}

export function usePublicCollab(slug: string | undefined) {
  return useQuery({
    queryKey: surveyKeys.publicCollab(slug ?? "unknown"),
    queryFn: async () => {
      const res = await resolveCollabApi(slug!);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "This link is not available.");
      }
      return res.data;
    },
    enabled: !!slug,
    retry: false,
  });
}

// ── usePublicSurvey (embed / anonymous fill, issue #7) ────────────

export function usePublicSurvey(id: string | undefined) {
  return useQuery({
    queryKey: surveyKeys.public(id ?? "unknown"),
    queryFn: async () => {
      const res = await getPublicSurveyApi(id!);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Survey not available");
      }
      return res.data;
    },
    enabled: !!id,
  });
}

// ── Responses & results (issue #12) ───────────────────────────────

export function useSubmitResponse(surveyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: SubmitResponseRequest) => {
      const res = await submitResponseApi(surveyId, data);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to submit response");
      }
      return res.data;
    },
    // A new response changes the owner's aggregates (e.g. the builder Preview
    // and the results dashboard), so refresh them.
    onSuccess: () => invalidateResponseData(queryClient, surveyId),
  });
}

// ── Edit after submission (issue #40) ─────────────────────────────

export function useResponseForEdit(token: string | undefined) {
  return useQuery({
    queryKey: surveyKeys.responseEdit(token ?? "unknown"),
    queryFn: async () => {
      const res = await getResponseForEditApi(token!);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "This edit link is not available.");
      }
      return res.data;
    },
    enabled: !!token,
    retry: false,
  });
}

export function useEditResponse(token: string) {
  return useMutation({
    mutationFn: async (data: SubmitResponseRequest) => {
      const res = await editResponseApi(token, data);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to update response");
      }
      return res.data;
    },
  });
}

// ── Save & Resume drafts (issue #26) ──────────────────────────────

export function useSaveDraft(surveyId: string) {
  return useMutation({
    mutationFn: async (data: SaveDraftRequest) => {
      const res = await saveDraftApi(surveyId, data);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to save draft");
      }
      return res.data;
    },
  });
}

export function useDraft(token: string | undefined) {
  return useQuery({
    queryKey: surveyKeys.draft(token ?? "unknown"),
    queryFn: async () => {
      const res = await getDraftApi(token!);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Draft not available");
      }
      return res.data;
    },
    enabled: !!token,
    retry: false,
  });
}

export function useDeleteDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      await deleteDraftApi(token);
    },
    onSuccess: (_data, token) =>
      queryClient.removeQueries({ queryKey: surveyKeys.draft(token) }),
  });
}

// ── Spam & bot protection (issue #31) ─────────────────────────────

/** Fetch a signed begin-token used for the server-side fill-time check. */
export function useBeginToken(surveyId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: surveyKeys.begin(surveyId ?? "unknown"),
    queryFn: async () => {
      const res = await getBeginTokenApi(surveyId!);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to start");
      }
      // Never return undefined — TanStack Query rejects it. null = no token.
      return res.data.beginToken ?? null;
    },
    enabled: !!surveyId && enabled,
    staleTime: Infinity,
    retry: false,
  });
}

export function useSurveyResults(
  surveyId: string | undefined,
  includePreview = false,
) {
  return useQuery({
    queryKey: [...surveyKeys.results(surveyId ?? "unknown"), { includePreview }],
    queryFn: async () => {
      const res = await getResultsApi(surveyId!, includePreview);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to load results");
      }
      return res.data;
    },
    enabled: !!surveyId,
    // Poll so new responses appear without a manual reload.
    refetchInterval: RESULTS_POLL_INTERVAL_MS,
  });
}

export function useDeletePreviewResponses(surveyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await deletePreviewResponsesApi(surveyId);
      if (!res.success) throw new Error(res.error ?? "Failed to delete preview data");
      return res.data ?? 0;
    },
    onSuccess: () => invalidateResponseData(queryClient, surveyId),
  });
}

export function useLiveResults(surveyId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: surveyKeys.liveResults(surveyId ?? "unknown"),
    queryFn: async () => {
      const res = await getLiveResultsApi(surveyId!);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Live results unavailable");
      }
      return res.data;
    },
    enabled: !!surveyId && enabled,
    retry: false,
  });
}

export function invalidateResponseData(
  queryClient: ReturnType<typeof useQueryClient>,
  surveyId: string,
) {
  queryClient.invalidateQueries({ queryKey: surveyKeys.responses(surveyId) });
  queryClient.invalidateQueries({ queryKey: surveyKeys.results(surveyId) });
  queryClient.invalidateQueries({ queryKey: surveyKeys.liveResults(surveyId) });
}

export function useDeleteResponse(surveyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (responseId: string) => {
      const res = await deleteResponseApi(surveyId, responseId);
      if (!res.success) throw new Error(res.error ?? "Failed to delete response");
    },
    onSuccess: () => invalidateResponseData(queryClient, surveyId),
  });
}

export function useClearResponses(surveyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await clearResponsesApi(surveyId);
      if (!res.success) throw new Error(res.error ?? "Failed to clear responses");
    },
    onSuccess: () => invalidateResponseData(queryClient, surveyId),
  });
}

export function useSurveyAnalytics(surveyId: string | undefined) {
  return useQuery({
    queryKey: surveyKeys.analytics(surveyId ?? "unknown"),
    queryFn: async () => {
      const res = await getAnalyticsApi(surveyId!);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to load analytics");
      }
      return res.data;
    },
    enabled: !!surveyId,
  });
}

export function useResponses(surveyId: string | undefined) {
  return useQuery({
    queryKey: surveyKeys.responses(surveyId ?? "unknown"),
    queryFn: async () => {
      const res = await listResponsesApi(surveyId!);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to load responses");
      }
      return res.data;
    },
    enabled: !!surveyId,
  });
}

// ── Webhooks (issue #36) ──────────────────────────────────────────

export function useWebhooks(surveyId: string | undefined) {
  return useQuery({
    queryKey: surveyKeys.webhooks(surveyId ?? "unknown"),
    queryFn: async () => {
      const res = await listWebhooksApi(surveyId!);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to load webhooks");
      }
      return res.data;
    },
    enabled: !!surveyId,
  });
}

export function useCreateWebhook(surveyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateWebhookRequest) => {
      const res = await createWebhookApi(surveyId, data);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to create webhook");
      }
      return res.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: surveyKeys.webhooks(surveyId) }),
  });
}

export function useDeleteWebhook(surveyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (webhookId: string) => {
      const res = await deleteWebhookApi(surveyId, webhookId);
      if (!res.success) throw new Error(res.error ?? "Failed to delete webhook");
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: surveyKeys.webhooks(surveyId) }),
  });
}

export function useTestWebhook(surveyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (webhookId: string) => {
      const res = await testWebhookApi(surveyId, webhookId);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to send test");
      }
      return res.data;
    },
    // The test updates the webhook's last-delivery status.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: surveyKeys.webhooks(surveyId) }),
  });
}
