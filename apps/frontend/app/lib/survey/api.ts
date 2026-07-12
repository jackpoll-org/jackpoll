/**
 * Survey API service — communicates with the Quarkus backend through the
 * Next.js proxy at {@code API_BASE_URL} (browser) or directly (server).
 */

import { API_BASE_URL, AUTH_STORAGE_KEY } from "@/app/lib/auth/constants";
import { refreshAccessToken } from "@/app/lib/auth/refresh";
import { SURVEY_ENDPOINTS } from "./constants";
import type { ApiResponse } from "@/app/types/auth";
import type {
  AccessCode,
  AddCollaboratorRequest,
  CollabLink,
  Collaborator,
  CreateSurveyRequest,
  CreateWebhookRequest,
  DraftDto,
  Folder,
  Invitation,
  NotificationPreferences,
  ResponseEditView,
  SaveDraftRequest,
  ShareLink,
  SubmitResponseRequest,
  Survey,
  SurveyAnalytics,
  SurveyResponseDto,
  SurveyResults,
  UpdateShareLinkRequest,
  UpdateSurveyRequest,
  UploadedFile,
  Webhook,
  WebhookTestResult,
} from "@/app/types/survey";

/**
 * Error carrying the HTTP status plus optional structured metadata: `reason`
 * and `limit` are surfaced by some endpoints so callers can render a specific
 * message. Falls back to a plain message.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly reason?: string;
  readonly limit?: number;

  constructor(message: string, status: number, reason?: string, limit?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.reason = reason;
    this.limit = limit;
  }
}

// ── Generic fetch helper ──────────────────────────────────────────

export async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;

  const buildHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    };
    const token =
      typeof window !== "undefined" ? localStorage.getItem(AUTH_STORAGE_KEY) : null;
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  };

  const hadToken =
    typeof window !== "undefined" && !!localStorage.getItem(AUTH_STORAGE_KEY);
  let res = await fetch(url, {
    ...options,
    headers: buildHeaders(),
    credentials: "include",
  });

  // Logged-in caller hit an expired token → silent single-flight refresh +
  // retry once (issue #35). Anonymous callers (public survey pages) skip this.
  if (res.status === 401 && hadToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await fetch(url, {
        ...options,
        headers: buildHeaders(),
        credentials: "include",
      });
    }
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      body.error ?? body.message ?? `Request failed with status ${res.status}`,
      res.status,
      body.reason,
      body.limit,
    );
  }

  return body as ApiResponse<T>;
}

// ── Survey API ────────────────────────────────────────────────────

export async function listSurveysApi(
  page = 0,
  limit = 20,
): Promise<ApiResponse<Survey[]>> {
  const query = `?page=${page}&limit=${limit}`;
  return request<Survey[]>(`${SURVEY_ENDPOINTS.list}${query}`);
}

export async function getSurveyApi(id: string): Promise<ApiResponse<Survey>> {
  return request<Survey>(SURVEY_ENDPOINTS.detail(id));
}

/** Public read of a published survey (for embedding / anonymous filling). */
export async function getPublicSurveyApi(
  id: string,
): Promise<ApiResponse<Survey>> {
  return request<Survey>(SURVEY_ENDPOINTS.publicDetail(id));
}

// ── Shareable link (issue #16) ────────────────────────────────────

export async function getShareLinkApi(
  surveyId: string,
): Promise<ApiResponse<ShareLink>> {
  return request<ShareLink>(SURVEY_ENDPOINTS.shareLink(surveyId));
}

export async function rotateShareLinkApi(
  surveyId: string,
): Promise<ApiResponse<ShareLink>> {
  return request<ShareLink>(SURVEY_ENDPOINTS.shareLinkRotate(surveyId), {
    method: "POST",
  });
}

export async function updateShareLinkApi(
  surveyId: string,
  data: UpdateShareLinkRequest,
): Promise<ApiResponse<ShareLink>> {
  return request<ShareLink>(SURVEY_ENDPOINTS.shareLink(surveyId), {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** Resolve a public share-link slug to its survey. */
export async function resolveLinkApi(slug: string): Promise<ApiResponse<Survey>> {
  return request<Survey>(SURVEY_ENDPOINTS.publicLink(slug));
}

// ── Access code (issue #15) ───────────────────────────────────────

export async function getAccessCodeApi(
  surveyId: string,
): Promise<ApiResponse<AccessCode>> {
  return request<AccessCode>(SURVEY_ENDPOINTS.accessCode(surveyId));
}

export async function rotateAccessCodeApi(
  surveyId: string,
): Promise<ApiResponse<AccessCode>> {
  return request<AccessCode>(SURVEY_ENDPOINTS.accessCodeRotate(surveyId), {
    method: "POST",
  });
}

export async function updateAccessCodeApi(
  surveyId: string,
  requireCode: boolean,
): Promise<ApiResponse<AccessCode>> {
  return request<AccessCode>(SURVEY_ENDPOINTS.accessCode(surveyId), {
    method: "PUT",
    body: JSON.stringify({ requireCode }),
  });
}

/** Resolve an entered access code to its survey. */
export async function resolveAccessCodeApi(
  code: string,
): Promise<ApiResponse<Survey>> {
  return request<Survey>(SURVEY_ENDPOINTS.publicAccessCode, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

// ── Collaboration edit link (issue #22) ───────────────────────────

export async function getCollabLinkApi(
  surveyId: string,
): Promise<ApiResponse<CollabLink>> {
  return request<CollabLink>(SURVEY_ENDPOINTS.collabLink(surveyId));
}

export async function rotateCollabLinkApi(
  surveyId: string,
): Promise<ApiResponse<CollabLink>> {
  return request<CollabLink>(SURVEY_ENDPOINTS.collabLinkRotate(surveyId), {
    method: "POST",
  });
}

export async function updateCollabLinkApi(
  surveyId: string,
  expiresAt: string | null,
): Promise<ApiResponse<CollabLink>> {
  return request<CollabLink>(SURVEY_ENDPOINTS.collabLink(surveyId), {
    method: "PUT",
    body: JSON.stringify({ expiresAt }),
  });
}

/** Resolve a collab-link slug to the editable survey. */
export async function resolveCollabApi(slug: string): Promise<ApiResponse<Survey>> {
  return request<Survey>(SURVEY_ENDPOINTS.publicCollab(slug));
}

/** Save edits to a survey via a collab-link slug (passwordless). */
export async function editCollabApi(
  slug: string,
  data: UpdateSurveyRequest,
): Promise<ApiResponse<Survey>> {
  return request<Survey>(SURVEY_ENDPOINTS.publicCollab(slug), {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function createSurveyApi(
  data: CreateSurveyRequest,
): Promise<ApiResponse<Survey>> {
  return request<Survey>(SURVEY_ENDPOINTS.create, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateSurveyApi(
  id: string,
  data: UpdateSurveyRequest,
): Promise<ApiResponse<Survey>> {
  return request<Survey>(SURVEY_ENDPOINTS.detail(id), {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteSurveyApi(id: string): Promise<ApiResponse<null>> {
  return request<null>(SURVEY_ENDPOINTS.detail(id), { method: "DELETE" });
}

// ── Organization: tags & folders (issue #33) ──────────────────────

export async function organizeSurveyApi(
  id: string,
  data: { tags: string[]; folderId: string | null },
): Promise<ApiResponse<Survey>> {
  return request<Survey>(SURVEY_ENDPOINTS.organize(id), {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** Persist the manual drag order of surveys in one folder/root (issue #94). */
export async function reorderSurveysApi(
  folderId: string | null,
  orderedIds: string[],
): Promise<ApiResponse<null>> {
  return request<null>(SURVEY_ENDPOINTS.reorder, {
    method: "PUT",
    body: JSON.stringify({ folderId, orderedIds }),
  });
}

export async function listFoldersApi(): Promise<ApiResponse<Folder[]>> {
  return request<Folder[]>(SURVEY_ENDPOINTS.folders);
}

export async function createFolderApi(
  name: string,
): Promise<ApiResponse<Folder>> {
  return request<Folder>(SURVEY_ENDPOINTS.folders, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function renameFolderApi(
  id: string,
  name: string,
): Promise<ApiResponse<Folder>> {
  return request<Folder>(SURVEY_ENDPOINTS.folder(id), {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
}

export async function deleteFolderApi(id: string): Promise<ApiResponse<null>> {
  return request<null>(SURVEY_ENDPOINTS.folder(id), { method: "DELETE" });
}

// ── Notification preferences (issue #89) ──────────────────────────

export async function getNotificationPrefsApi(): Promise<
  ApiResponse<NotificationPreferences>
> {
  return request<NotificationPreferences>(SURVEY_ENDPOINTS.notificationPreferences);
}

export async function updateNotificationPrefsApi(
  prefs: NotificationPreferences,
): Promise<ApiResponse<NotificationPreferences>> {
  return request<NotificationPreferences>(SURVEY_ENDPOINTS.notificationPreferences, {
    method: "PUT",
    body: JSON.stringify(prefs),
  });
}

// ── Webhooks (issue #36) ──────────────────────────────────────────

export async function listWebhooksApi(
  surveyId: string,
): Promise<ApiResponse<Webhook[]>> {
  return request<Webhook[]>(SURVEY_ENDPOINTS.webhooks(surveyId));
}

export async function createWebhookApi(
  surveyId: string,
  data: CreateWebhookRequest,
): Promise<ApiResponse<Webhook>> {
  return request<Webhook>(SURVEY_ENDPOINTS.webhooks(surveyId), {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteWebhookApi(
  surveyId: string,
  webhookId: string,
): Promise<ApiResponse<null>> {
  return request<null>(SURVEY_ENDPOINTS.webhook(surveyId, webhookId), {
    method: "DELETE",
  });
}

export async function testWebhookApi(
  surveyId: string,
  webhookId: string,
): Promise<ApiResponse<WebhookTestResult>> {
  return request<WebhookTestResult>(
    SURVEY_ENDPOINTS.webhookTest(surveyId, webhookId),
    { method: "POST" },
  );
}

// ── Collaborators (issue #8) ──────────────────────────────────────

export async function listCollaboratorsApi(
  surveyId: string,
): Promise<ApiResponse<Collaborator[]>> {
  return request<Collaborator[]>(SURVEY_ENDPOINTS.collaborators(surveyId));
}

export async function addCollaboratorApi(
  surveyId: string,
  data: AddCollaboratorRequest,
): Promise<ApiResponse<Collaborator>> {
  return request<Collaborator>(SURVEY_ENDPOINTS.collaborators(surveyId), {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function removeCollaboratorApi(
  surveyId: string,
  userId: string,
): Promise<ApiResponse<null>> {
  return request<null>(SURVEY_ENDPOINTS.collaborator(surveyId, userId), {
    method: "DELETE",
  });
}

// ── Invitations (invitee-facing, issue #8) ────────────────────────

export async function listInvitationsApi(): Promise<ApiResponse<Invitation[]>> {
  return request<Invitation[]>(SURVEY_ENDPOINTS.invitations());
}

export async function acceptInvitationApi(
  surveyId: string,
): Promise<ApiResponse<null>> {
  return request<null>(SURVEY_ENDPOINTS.acceptInvitation(surveyId), {
    method: "POST",
  });
}

export async function declineInvitationApi(
  surveyId: string,
): Promise<ApiResponse<null>> {
  return request<null>(SURVEY_ENDPOINTS.declineInvitation(surveyId), {
    method: "POST",
  });
}

// ── Responses & results ───────────────────────────────────────────

export async function submitResponseApi(
  surveyId: string,
  data: SubmitResponseRequest,
): Promise<ApiResponse<SurveyResponseDto>> {
  return request<SurveyResponseDto>(SURVEY_ENDPOINTS.responses(surveyId), {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Register a push device for the current user. Native (mobile) passes an
 * FCM/APNs token; Web Push (#74) passes the endpoint as the token plus the
 * subscription's p256dh/auth encryption keys.
 */
export async function registerDeviceApi(
  token: string,
  platform: string,
  keys?: { p256dh: string; auth: string },
): Promise<ApiResponse<unknown>> {
  return request<unknown>("/me/devices", {
    method: "POST",
    body: JSON.stringify({ token, platform, ...keys }),
  });
}

/** The instance's VAPID public key for Web Push subscriptions (#74). */
export async function getWebPushKeyApi(): Promise<
  ApiResponse<{ enabled: boolean; publicKey: string }>
> {
  return request<{ enabled: boolean; publicKey: string }>("/me/devices/web-push-key");
}

export async function getResultsApi(
  surveyId: string,
  includePreview = false,
): Promise<ApiResponse<SurveyResults>> {
  const q = includePreview ? "?preview=true" : "";
  return request<SurveyResults>(`${SURVEY_ENDPOINTS.results(surveyId)}${q}`);
}

/** Presenter live mode: broadcast the current question index to participants (#). */
export async function setLiveStateApi(
  surveyId: string,
  index: number,
  phase = "question",
): Promise<ApiResponse<null>> {
  return request<null>(SURVEY_ENDPOINTS.liveState(surveyId), {
    method: "POST",
    body: JSON.stringify({ index, phase }),
  });
}

/** Participant lobby check-in: announce a nickname so the presenter can list it. */
export async function liveJoinApi(
  surveyId: string,
  name: string,
): Promise<ApiResponse<null>> {
  return request<null>(SURVEY_ENDPOINTS.liveJoin(surveyId), {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

/** Delete just the builder's preview/test submissions for a survey (#). */
export async function deletePreviewResponsesApi(
  surveyId: string,
): Promise<ApiResponse<number>> {
  return request<number>(`${SURVEY_ENDPOINTS.responses(surveyId)}/preview`, {
    method: "DELETE",
  });
}

// ── Edit after submission (issue #40) ─────────────────────────────

/** Fetch a submitted response (by its private edit token) for editing. */
export async function getResponseForEditApi(
  token: string,
): Promise<ApiResponse<ResponseEditView>> {
  return request<ResponseEditView>(SURVEY_ENDPOINTS.responseEdit(token));
}

/** Update a submitted response in place via its edit token. */
export async function editResponseApi(
  token: string,
  data: SubmitResponseRequest,
): Promise<ApiResponse<SurveyResponseDto>> {
  return request<SurveyResponseDto>(SURVEY_ENDPOINTS.responseEdit(token), {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ── Spam & bot protection (issue #31) ─────────────────────────────

/** Fetch a signed begin-token for the server-side fill-time check. */
export async function getBeginTokenApi(
  surveyId: string,
): Promise<ApiResponse<{ beginToken: string }>> {
  return request<{ beginToken: string }>(SURVEY_ENDPOINTS.begin(surveyId));
}

/** Absolute proxy URL of the Altcha challenge endpoint for the widget. */
export function altchaChallengeUrl(surveyId: string): string {
  return `${API_BASE_URL}${SURVEY_ENDPOINTS.altcha(surveyId)}`;
}

// ── Save & Resume drafts (issue #26) ──────────────────────────────

/** Create or update an anonymous draft; returns the resume token. */
export async function saveDraftApi(
  surveyId: string,
  data: SaveDraftRequest,
): Promise<ApiResponse<DraftDto>> {
  return request<DraftDto>(SURVEY_ENDPOINTS.drafts(surveyId), {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Restore a draft by token (rejects unknown/expired). */
export async function getDraftApi(token: string): Promise<ApiResponse<DraftDto>> {
  return request<DraftDto>(SURVEY_ENDPOINTS.draft(token));
}

/** Discard a draft (e.g. after a successful submission). */
export async function deleteDraftApi(token: string): Promise<ApiResponse<null>> {
  return request<null>(SURVEY_ENDPOINTS.draft(token), { method: "DELETE" });
}

/** Public live results — only the questions the owner opted in (issue #21). */
export async function getLiveResultsApi(
  surveyId: string,
): Promise<ApiResponse<SurveyResults>> {
  return request<SurveyResults>(SURVEY_ENDPOINTS.liveResults(surveyId));
}

/** Owner survey analytics (issue #34). */
export async function getAnalyticsApi(
  surveyId: string,
): Promise<ApiResponse<SurveyAnalytics>> {
  return request<SurveyAnalytics>(SURVEY_ENDPOINTS.analytics(surveyId));
}

export async function listResponsesApi(
  surveyId: string,
): Promise<ApiResponse<SurveyResponseDto[]>> {
  return request<SurveyResponseDto[]>(SURVEY_ENDPOINTS.responses(surveyId));
}

export async function deleteResponseApi(
  surveyId: string,
  responseId: string,
): Promise<ApiResponse<null>> {
  return request<null>(SURVEY_ENDPOINTS.response(surveyId, responseId), {
    method: "DELETE",
  });
}

export async function clearResponsesApi(
  surveyId: string,
): Promise<ApiResponse<null>> {
  return request<null>(SURVEY_ENDPOINTS.responses(surveyId), { method: "DELETE" });
}

/**
 * Download the formatted Excel (.xlsx) export of a survey's responses
 * (issue #32). Returns the raw bytes so the caller can save them.
 */
export async function downloadXlsxApi(
  surveyId: string,
  filters?: { from?: string; to?: string },
): Promise<Blob> {
  const params = new URLSearchParams();
  if (filters?.from) params.set("from", filters.from);
  if (filters?.to) params.set("to", filters.to);
  const query = params.toString() ? `?${params.toString()}` : "";

  const token =
    typeof window !== "undefined" ? localStorage.getItem(AUTH_STORAGE_KEY) : null;
  const res = await fetch(
    `${API_BASE_URL}${SURVEY_ENDPOINTS.exportXlsx(surveyId)}${query}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: "include",
    },
  );
  if (!res.ok) {
    throw new Error(`Export failed with status ${res.status}`);
  }
  return res.blob();
}

/** Download one response as a branded PDF (issue #84). */
export async function downloadResponsePdfApi(
  surveyId: string,
  responseId: string,
): Promise<Blob> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem(AUTH_STORAGE_KEY) : null;
  const res = await fetch(
    `${API_BASE_URL}${SURVEY_ENDPOINTS.responsePdf(surveyId, responseId)}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: "include",
    },
  );
  if (!res.ok) {
    throw new Error(`PDF export failed with status ${res.status}`);
  }
  return res.blob();
}

/**
 * Upload a file via multipart form data. The browser sets the multipart
 * Content-Type (with boundary), so we don't set it manually here.
 */
export async function uploadFileApi(file: File): Promise<UploadedFile> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem(AUTH_STORAGE_KEY) : null;
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE_URL}/uploads`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
    credentials: "include",
  });

  const body = (await res.json().catch(() => ({}))) as ApiResponse<UploadedFile>;
  if (!res.ok || !body.success || !body.data) {
    throw new Error(body.error ?? `Upload failed with status ${res.status}`);
  }
  return body.data;
}

/**
 * Stable URL for displaying an uploaded image. The backend streams the object
 * from MinIO through the API proxy, so we never expose the internal storage
 * host (e.g. `minio:9000`) and the URL never expires. Always derive the URL
 * from the stored `key` rather than trusting a presigned `url` baked into an
 * older response.
 */
export function uploadFileUrl(key: string): string {
  return `${API_BASE_URL}/uploads/raw?key=${encodeURIComponent(key)}`;
}
