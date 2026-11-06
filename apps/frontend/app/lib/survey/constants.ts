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
  liveSessions: (id: string) => [...surveyKeys.all, "live-sessions", id] as const,
  liveLeaderboard: (id: string) => [...surveyKeys.all, "live-leaderboard", id] as const,
  collaborators: (id: string) => [...surveyKeys.all, "collaborators", id] as const,
  invitations: () => [...surveyKeys.all, "invitations"] as const,
  webhooks: (id: string) => [...surveyKeys.all, "webhooks", id] as const,
  shareLink: (id: string) => [...surveyKeys.all, "share-link", id] as const,
  publicLink: (slug: string) => [...surveyKeys.all, "public-link", slug] as const,
  accessCode: (id: string) => [...surveyKeys.all, "access-code", id] as const,
  respondentTokens: (id: string) => [...surveyKeys.all, "respondent-tokens", id] as const,
  collabLink: (id: string) => [...surveyKeys.all, "collab-link", id] as const,
  publicCollab: (slug: string) => [...surveyKeys.all, "public-collab", slug] as const,
};

/** Query key for the user's folders (issue #33). */
export const foldersKey = ["folders"] as const;
export const apiKeysKey = ["api-keys"] as const;

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
  detail: (id: string) => `/surveys/${encodeURIComponent(id)}`,
  organize: (id: string) => `/surveys/${encodeURIComponent(id)}/organize`,
  reorder: "/surveys/reorder",
  folders: "/folders",
  apiKeys: "/me/api-keys",
  apiKey: (id: string) => `/me/api-keys/${encodeURIComponent(id)}`,
  folder: (id: string) => `/folders/${encodeURIComponent(id)}`,
  responseEdit: (token: string) => `/public/responses/${encodeURIComponent(token)}`,
  publicDetail: (id: string) => `/public/surveys/${encodeURIComponent(id)}`,
  liveResults: (id: string) => `/public/surveys/${encodeURIComponent(id)}/live-results`,
  analytics: (id: string) => `/surveys/${encodeURIComponent(id)}/analytics`,
  track: (id: string) => `/public/surveys/${encodeURIComponent(id)}/track`,
  drafts: (id: string) => `/public/surveys/${encodeURIComponent(id)}/drafts`,
  draft: (token: string) => `/public/drafts/${encodeURIComponent(token)}`,
  begin: (id: string) => `/public/surveys/${encodeURIComponent(id)}/begin`,
  altcha: (id: string) => `/public/surveys/${encodeURIComponent(id)}/altcha`,
  responded: (id: string) => `/public/surveys/${encodeURIComponent(id)}/responded`,
  studentResult: (id: string) => `/public/surveys/${encodeURIComponent(id)}/result`,
  responses: (id: string) => `/surveys/${encodeURIComponent(id)}/responses`,
  response: (id: string, responseId: string) =>
    `/surveys/${encodeURIComponent(id)}/responses/${encodeURIComponent(responseId)}`,
  results: (id: string) => `/surveys/${encodeURIComponent(id)}/results`,
  exportXlsx: (id: string) => `/surveys/${encodeURIComponent(id)}/export/xlsx`,
  responsePdf: (id: string, responseId: string) =>
    `/surveys/${encodeURIComponent(id)}/responses/${encodeURIComponent(responseId)}/pdf`,
  webhooks: (id: string) => `/surveys/${encodeURIComponent(id)}/webhooks`,
  webhook: (id: string, hookId: string) => `/surveys/${encodeURIComponent(id)}/webhooks/${encodeURIComponent(hookId)}`,
  webhookTest: (id: string, hookId: string) =>
    `/surveys/${encodeURIComponent(id)}/webhooks/${encodeURIComponent(hookId)}/test`,
  collaborators: (id: string) => `/surveys/${encodeURIComponent(id)}/collaborators`,
  collaborator: (id: string, userId: string) =>
    `/surveys/${encodeURIComponent(id)}/collaborators/${encodeURIComponent(userId)}`,
  invitations: () => `/collaborations/invitations`,
  acceptInvitation: (surveyId: string) => `/collaborations/${encodeURIComponent(surveyId)}/accept`,
  declineInvitation: (surveyId: string) => `/collaborations/${encodeURIComponent(surveyId)}/decline`,
  liveState: (id: string) => `/surveys/${encodeURIComponent(id)}/live/state`,
  liveJoin: (id: string) => `/surveys/${encodeURIComponent(id)}/live/join`,
  liveSessions: (id: string) => `/surveys/${encodeURIComponent(id)}/live/sessions`,
  liveLeaderboard: (id: string) => `/surveys/${encodeURIComponent(id)}/live/leaderboard`,
  shareLink: (id: string) => `/surveys/${encodeURIComponent(id)}/share-link`,
  shareLinkRotate: (id: string) => `/surveys/${encodeURIComponent(id)}/share-link/rotate`,
  publicLink: (slug: string) => `/public/links/${encodeURIComponent(slug)}`,
  collabLink: (id: string) => `/surveys/${encodeURIComponent(id)}/collab-link`,
  collabLinkRotate: (id: string) => `/surveys/${encodeURIComponent(id)}/collab-link/rotate`,
  publicCollab: (slug: string) => `/public/collab/${encodeURIComponent(slug)}`,
  accessCode: (id: string) => `/surveys/${encodeURIComponent(id)}/access-code`,
  accessCodeRotate: (id: string) => `/surveys/${encodeURIComponent(id)}/access-code/rotate`,
  publicAccessCode: "/public/access-code",
  respondentTokens: (id: string) => `/surveys/${encodeURIComponent(id)}/respondent-tokens`,
  respondentTokensGenerate: (id: string) => `/surveys/${encodeURIComponent(id)}/respondent-tokens/generate`,
  respondentToken: (id: string, tokenId: string) => `/surveys/${encodeURIComponent(id)}/respondent-tokens/${encodeURIComponent(tokenId)}`,
  templates: "/templates",
  template: (id: string) => `/templates/${encodeURIComponent(id)}`,
  notificationPreferences: "/notification-preferences",
  notifications: "/notifications",
  notificationsUnreadCount: "/notifications/unread-count",
  notificationRead: (id: string) => `/notifications/${encodeURIComponent(id)}/read`,
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
