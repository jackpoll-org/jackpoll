// ── Auth constants ─────────────────────────────────────────────────

/** Key used for storing auth state in localStorage (access token). */
export const AUTH_STORAGE_KEY = "survey-auth-token";

/** Key used for storing user data in localStorage. */
export const AUTH_USER_KEY = "survey-auth-user";

/** Query key factory for TanStack Query auth keys. */
export const authKeys = {
  all: ["auth"] as const,
  user: () => [...authKeys.all, "user"] as const,
  session: () => [...authKeys.all, "session"] as const,
};

/**
 * Backend base URL.
 *
 * In the browser, requests go through the Next.js API proxy at /api/*
 * to avoid CORS issues. On the server (e.g., Server Components), we
 * can call the backend directly.
 */
export const API_BASE_URL =
  typeof window !== "undefined"
    ? "/api" // Browser → proxy through Next.js Route Handler
    : `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"}/api/v1`; // Server → direct, like the proxy

/** Minimum password length. */
export const MIN_PASSWORD_LENGTH = 8;

/** Auth endpoints relative to API_BASE_URL. */
export const AUTH_ENDPOINTS = {
  register: "/auth/register",
  login: "/auth/login",
  logout: "/auth/logout",
  logoutAll: "/auth/logout-all",
  me: "/auth/me",
  profile: "/auth/profile",
  changePassword: "/auth/change-password",
  verifyEmail: "/auth/verify-email",
  resendVerification: "/auth/resend-verification",
  forgotPassword: "/auth/forgot-password",
  resetPassword: "/auth/reset-password",
  deleteAccountRequest: "/auth/delete-account/request",
  deleteAccountConfirm: "/auth/delete-account/confirm",
  deleteDataRequest: "/auth/delete-data/request",
  deleteDataConfirm: "/auth/delete-data/confirm",
} as const;

/** Paths that do NOT require authentication. */
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  // Public account/data deletion — reachable without login (Play Store
  // requirement + real self-service path when the user can't sign in).
  "/delete-account",
  "/delete-data",
  // Public survey surfaces — respondents are anonymous (issues #7/#16/#26/#40/#15/#22).
  "/embed", // iframe embed
  "/s", // shareable public link
  "/r", // resume a saved draft
  "/e", // edit a submitted response
  "/join", // access-code entry
  "/collab", // passwordless collaborator link
  // Legal pages must be reachable by anyone (GDPR #61/#62/#67).
  "/privacy",
  "/impressum",
  "/terms",
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
