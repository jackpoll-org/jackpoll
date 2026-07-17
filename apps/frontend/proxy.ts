import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
];

/** Paths that should redirect to `/` if already authenticated. */
const GUEST_ONLY_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public assets through (icons, manifest, service worker, etc. must be
  // reachable by anonymous users — otherwise the logo/PWA 307 to /login).
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/badges") ||
    pathname.startsWith("/locales") ||
    // App Links / Universal Links association files must be publicly reachable
    // (and never redirected) for OS verification (#71).
    pathname.startsWith("/.well-known") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/offline.html" ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // Check if current path is public (no auth required)
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isGuestOnly = GUEST_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Read token from cookie (preferred) or Authorization header
  const token =
    request.cookies.get("survey-auth-token")?.value ??
    request.headers.get("Authorization")?.replace("Bearer ", "");

  // If user is authenticated and tries to access a guest-only path, redirect home
  if (token && isGuestOnly) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // If user is NOT authenticated and tries to access a protected path, redirect to login
  if (!token && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
