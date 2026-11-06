import { NextRequest, NextResponse } from "next/server";

/**
 * Catch-all API proxy — forwards requests to the Quarkus backend.
 *
 * Why: The frontend runs on a different port than the backend, so direct
 * browser fetch() calls trigger CORS preflight checks. Rather than relying
 * on the backend's CORS configuration (which can be fragile), we proxy
 * through Next.js Route Handlers to avoid CORS entirely.
 *
 * Usage: Frontend calls `/api/auth/login` → this handler forwards to
 * `${BACKEND_URL}/auth/login` and returns the response.
 */

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

/** Just above the backend's own 10 MB body limit. */
const MAX_BODY_BYTES = 11 * 1024 * 1024;

/** Streams the body through while counting, so an oversized upload is cut off without being held in memory. */
function limitBytes(max: number): TransformStream<Uint8Array, Uint8Array> {
  let seen = 0;
  return new TransformStream({
    transform(chunk, controller) {
      seen += chunk.byteLength;
      if (seen > max) controller.error(new Error("Request body too large"));
      else controller.enqueue(chunk);
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(request, await params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(request, await params);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(request, await params);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(request, await params);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(request, await params);
}

/**
 * Reject any path segment that could climb out of the `/api/v1/` prefix once
 * the URL is normalized (`..`, `.`, or an embedded slash from a decoded
 * `%2e%2e%2f`). Without this, a crafted path could reach non-API backend routes
 * on the trusted host (e.g. health/metrics endpoints).
 */
function isSafePath(segments: string[]): boolean {
  return segments.every(
    (seg) =>
      seg.length > 0 &&
      seg !== "." &&
      seg !== ".." &&
      !seg.includes("/") &&
      !seg.includes("\\"),
  );
}

async function proxyRequest(
  request: NextRequest,
  params: { path: string[] },
) {
  if (!isSafePath(params.path)) {
    return NextResponse.json(
      { success: false, error: "Invalid path" },
      { status: 400 },
    );
  }
  // Next decodes each segment once; re-encode so a double-encoded "%2e%2e",
  // "?" or "#" stays a literal segment instead of climbing out of /api/v1.
  const backendPath = params.path.map(encodeURIComponent).join("/");
  const searchParams = request.nextUrl.searchParams;
  const fullUrl = searchParams.toString()
    ? `${BACKEND_URL}/api/v1/${backendPath}?${searchParams.toString()}`
    : `${BACKEND_URL}/api/v1/${backendPath}`;

  // Build headers — forward Authorization and Content-Type, drop host/origin
  const headers = new Headers();
  const contentType = request.headers.get("Content-Type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }
  const authorization = request.headers.get("Authorization");
  if (authorization) {
    headers.set("Authorization", authorization);
  }
  const cookie = request.headers.get("Cookie");
  if (cookie) {
    headers.set("Cookie", cookie);
  }
  // Forward the client IP so the backend can rate-limit per respondent (#31).
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    headers.set("X-Forwarded-For", forwardedFor);
  }
  // Biometric persistent login (native): the request to opt into an offline
  // token, and the offline token itself on refresh/logout. Without forwarding
  // these the backend never issues/accepts the offline token. X-Access-Token
  // and X-Resume-Token unlock surveys that require an access code.
  for (const name of ["X-Auth-Offline", "X-Refresh-Token", "X-Access-Token", "X-Resume-Token", "X-Collab-Link"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  if (Number(request.headers.get("Content-Length") ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json(
      { success: false, error: "Request body too large" },
      { status: 413 },
    );
  }
  const body =
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    request.body &&
    request.headers.get("Content-Length") !== "0"
      ? request.body.pipeThrough(limitBytes(MAX_BODY_BYTES))
      : null;

  try {
    const response = await fetch(fullUrl, {
      method: request.method,
      headers,
      body,
      duplex: "half",
    } as RequestInit);

    // Build response headers — forward Set-Cookie and Content-Type
    const responseHeaders = new Headers();
    const resContentType = response.headers.get("Content-Type");
    if (resContentType) {
      responseHeaders.set("Content-Type", resContentType);
    }
    // Forward Content-Disposition so file downloads keep their filename.
    const disposition = response.headers.get("Content-Disposition");
    if (disposition) {
      responseHeaders.set("Content-Disposition", disposition);
    }
    responseHeaders.set("Cache-Control", response.headers.get("Cache-Control") ?? "no-store");
    responseHeaders.set(
      "Content-Security-Policy",
      response.headers.get("Content-Security-Policy") ?? "default-src 'none'; frame-ancestors 'none'; sandbox",
    );
    responseHeaders.set("X-Content-Type-Options", "nosniff");

    // Forward Set-Cookie headers
    const setCookies = response.headers.getSetCookie?.();
    if (setCookies) {
      for (const cookie of setCookies) {
        responseHeaders.append("Set-Cookie", cookie);
      }
    }

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[API Proxy] Error forwarding to ${fullUrl}:`, error);
    return NextResponse.json(
      { success: false, error: "Backend unavailable" },
      { status: 502 },
    );
  }
}