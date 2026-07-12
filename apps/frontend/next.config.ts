import type { NextConfig } from "next";

/**
 * The mobile apps (iOS/Android) wrap this same deployment via Capacitor in
 * `server.url` mode — they load the live site, so there is a single SSR build
 * and source of truth. Offline + native features are layered on by the service
 * worker (public/sw.js) and Capacitor plugins, not a separate static export.
 */

/**
 * Content-Security-Policy directives shared by every route. `frame-ancestors`
 * is appended per-route (self for the app, * for the public embed widget).
 *
 * script/style use 'unsafe-inline' because Next.js injects inline bootstrap
 * scripts and Tailwind/shadcn inject inline styles; a nonce-based strict CSP is
 * the follow-up hardening. Even so this blocks external script injection,
 * <base>/<object>/<embed> abuse, and cross-site form posts, and constrains where
 * the app may connect, load images, and run workers.
 */
const CSP_BASE = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "connect-src 'self' https: wss:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

/**
 * Security headers applied to every route EXCEPT the public embed widget.
 * `frame-ancestors 'self'` (plus the legacy X-Frame-Options fallback) stops
 * other sites from putting the logged-in app inside a hidden iframe and
 * tricking owners into clicking destructive actions (clickjacking). HSTS,
 * Referrer-Policy and Permissions-Policy add transport + privacy hardening.
 */
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: `${CSP_BASE}; frame-ancestors 'self'`,
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  // Emit a self-contained server build (.next/standalone) for a small,
  // dependency-light production Docker image.
  output: "standalone",
  async rewrites() {
    // App Links / Universal Links association files must live at their exact
    // /.well-known/ paths (#71). Serve them from /api routes so they can be
    // env-gated; these specific segments win over the [...path] backend proxy.
    return [
      {
        source: "/.well-known/apple-app-site-association",
        destination: "/api/well-known/aasa",
      },
      {
        source: "/.well-known/assetlinks.json",
        destination: "/api/well-known/assetlinks",
      },
    ];
  },
  async headers() {
    return [
      {
        // The embed view is a deliberately public widget that any site may
        // frame (issue #7) — it exposes no privileged/owner actions, so it keeps
        // the same CSP but allows framing from anywhere.
        source: "/embed/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `${CSP_BASE}; frame-ancestors *`,
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Everything else (dashboard, builder, auth, public response pages):
        // only this origin may frame it. Blocks cross-site clickjacking.
        source: "/((?!embed).*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
