// ── Survey constants ───────────────────────────────────────────────

/** Query key factory for TanStack Query survey keys. */
export const surveyKeys = {
  all: ["surveys"] as const,
  lists: () => [...surveyKeys.all, "list"] as const,
  list: (page: number, limit: number) =>
    [...surveyKeys.lists(), { page, limit }] as const,
  details: () => [...surveyKeys.all, "detail"] as const,
  detail: (id: string) => [...surveyKeys.details(), id] as const,
  public: (id: string) => [...surveyKeys.all, "public", id] as const,
  draft: (token: string) => [...surveyKeys.all, "draft", token] as const,
  responseEdit: (token: string) => [...surveyKeys.all, "response-edit", token] as const,
  begin: (id: string) => [...surveyKeys.all, "begin", id] as const,
  results: (id: string) => [...surveyKeys.all, "results", id] as const,
  liveResults: (id: string) => [...surveyKeys.all, "live-results", id] as const,
  analytics: (id: string) => [...surveyKeys.all, "analytics", id] as const,
  responses: (id: string) => [...surveyKeys.all, "responses", id] as const,
  collaborators: (id: string) => [...surveyKeys.all, "collaborators", id] as const,
  invitations: () => [...surveyKeys.all, "invitations"] as const,
  webhooks: (id: string) => [...surveyKeys.all, "webhooks", id] as const,
  shareLink: (id: string) => [...surveyKeys.all, "share-link", id] as const,
  publicLink: (slug: string) => [...surveyKeys.all, "public-link", slug] as const,
  accessCode: (id: string) => [...surveyKeys.all, "access-code", id] as const,
  collabLink: (id: string) => [...surveyKeys.all, "collab-link", id] as const,
  publicCollab: (slug: string) => [...surveyKeys.all, "public-collab", slug] as const,
};

/** Query key for the user's folders (issue #33). */
export const foldersKey = ["folders"] as const;

/** Query key for account-level notification preferences (issue #89). */
export const notificationPrefsKey = ["notification-preferences"] as const;

/** Query key factory for the in-app notification center (issue #89). */
export const notificationsKeys = {
  all: ["notifications"] as const,
  lists: () => [...notificationsKeys.all, "list"] as const,
  list: (page: number, limit: number) =>
    [...notificationsKeys.lists(), { page, limit }] as const,
  unreadCount: () => [...notificationsKeys.all, "unread-count"] as const,
};

/** Survey endpoints relative to API_BASE_URL (proxied to backend /api/v1). */
export const SURVEY_ENDPOINTS = {
  list: "/surveys",
  create: "/surveys",
  detail: (id: string) => `/surveys/${id}`,
  organize: (id: string) => `/surveys/${id}/organize`,
  reorder: "/surveys/reorder",
  folders: "/folders",
  folder: (id: string) => `/folders/${id}`,
  responseEdit: (token: string) => `/public/responses/${token}`,
  publicDetail: (id: string) => `/public/surveys/${id}`,
  liveResults: (id: string) => `/public/surveys/${id}/live-results`,
  analytics: (id: string) => `/surveys/${id}/analytics`,
  track: (id: string) => `/public/surveys/${id}/track`,
  drafts: (id: string) => `/public/surveys/${id}/drafts`,
  draft: (token: string) => `/public/drafts/${token}`,
  begin: (id: string) => `/public/surveys/${id}/begin`,
  altcha: (id: string) => `/public/surveys/${id}/altcha`,
  responses: (id: string) => `/surveys/${id}/responses`,
  response: (id: string, responseId: string) =>
    `/surveys/${id}/responses/${responseId}`,
  results: (id: string) => `/surveys/${id}/results`,
  exportXlsx: (id: string) => `/surveys/${id}/export/xlsx`,
  responsePdf: (id: string, responseId: string) =>
    `/surveys/${id}/responses/${responseId}/pdf`,
  webhooks: (id: string) => `/surveys/${id}/webhooks`,
  webhook: (id: string, hookId: string) => `/surveys/${id}/webhooks/${hookId}`,
  webhookTest: (id: string, hookId: string) =>
    `/surveys/${id}/webhooks/${hookId}/test`,
  collaborators: (id: string) => `/surveys/${id}/collaborators`,
  collaborator: (id: string, userId: string) =>
    `/surveys/${id}/collaborators/${userId}`,
  invitations: () => `/collaborations/invitations`,
  acceptInvitation: (surveyId: string) => `/collaborations/${surveyId}/accept`,
  declineInvitation: (surveyId: string) => `/collaborations/${surveyId}/decline`,
  liveState: (id: string) => `/surveys/${id}/live/state`,
  liveJoin: (id: string) => `/surveys/${id}/live/join`,
  shareLink: (id: string) => `/surveys/${id}/share-link`,
  shareLinkRotate: (id: string) => `/surveys/${id}/share-link/rotate`,
  publicLink: (slug: string) => `/public/links/${slug}`,
  collabLink: (id: string) => `/surveys/${id}/collab-link`,
  collabLinkRotate: (id: string) => `/surveys/${id}/collab-link/rotate`,
  publicCollab: (slug: string) => `/public/collab/${slug}`,
  accessCode: (id: string) => `/surveys/${id}/access-code`,
  accessCodeRotate: (id: string) => `/surveys/${id}/access-code/rotate`,
  publicAccessCode: "/public/access-code",
  templates: "/templates",
  template: (id: string) => `/templates/${id}`,
  notificationPreferences: "/notification-preferences",
  notifications: "/notifications",
  notificationsUnreadCount: "/notifications/unread-count",
  notificationRead: (id: string) => `/notifications/${id}/read`,
  notificationsReadAll: "/notifications/read-all",
} as const;

/** Query key for the user's saved templates (issue #20). */
export const templatesKey = ["templates"] as const;

/** How often (ms) the results dashboard polls for new responses. */
export const RESULTS_POLL_INTERVAL_MS = 15000;

/** How often (ms) the notification bell polls for the unread count (issue #89). */
export const NOTIFICATIONS_POLL_INTERVAL_MS = 30000;

/** Default page size for the survey dashboard list. */
export const DEFAULT_PAGE_SIZE = 20;
