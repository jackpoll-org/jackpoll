import { NextResponse } from "next/server";

// Apple App Site Association (#71). Reached at /.well-known/apple-app-site-association
// via a rewrite (next.config) — a dedicated route under /api so it takes
// precedence over the [...path] backend proxy. Emitted only when APPLE_APP_ID
// (e.g. "ABCDE12345.de.quavon.jackpoll") is set; otherwise 404.
export const dynamic = "force-dynamic";

// Paths the app should claim — public survey surfaces + auth email links.
const PATHS = [
  "/s/*",
  "/r/*",
  "/e/*",
  "/join/*",
  "/collab/*",
  "/embed/*",
  "/verify-email*",
  "/reset-password*",
  "/forgot-password*",
];

export function GET() {
  const appID = process.env.APPLE_APP_ID;
  if (!appID) {
    return new NextResponse("Not configured", { status: 404 });
  }
  return NextResponse.json(
    { applinks: { apps: [], details: [{ appID, paths: PATHS }] } },
    { headers: { "content-type": "application/json" } },
  );
}
