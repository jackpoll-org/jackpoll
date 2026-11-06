// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

const params = (path: string[]) => ({ params: Promise.resolve({ path }) });

afterEach(() => vi.unstubAllGlobals());

describe("API proxy", () => {
  it("refuses a body larger than the backend accepts without forwarding it", async () => {
    const backend = vi.fn();
    vi.stubGlobal("fetch", backend);

    const res = await POST(
      new NextRequest("http://app.test/api/uploads", {
        method: "POST",
        headers: { "Content-Length": String(200 * 1024 * 1024) },
        body: "x",
      }),
      params(["uploads"]),
    );

    expect(res.status).toBe(413);
    expect(backend).not.toHaveBeenCalled();
  });

  it("streams an ordinary body through to the backend", async () => {
    let forwarded = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        forwarded = await new Response(init.body).text();
        return new Response("{}", { status: 201 });
      }),
    );

    const res = await POST(
      new NextRequest("http://app.test/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Hi" }),
      }),
      params(["surveys"]),
    );

    expect(res.status).toBe(201);
    expect(forwarded).toBe('{"title":"Hi"}');
  });

  it("marks backend responses as not cacheable unless the backend says otherwise", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));

    const res = await GET(new NextRequest("http://app.test/api/auth/me"), params(["auth", "me"]));

    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("keeps the backend's own caching for responses that set it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("img", { headers: { "Cache-Control": "public, max-age=3600" } })),
    );

    const res = await GET(new NextRequest("http://app.test/api/uploads/raw"), params(["uploads", "raw"]));

    expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
  });

  it("sandboxes responses the backend sends without a policy and keeps the backend's own", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<svg/>", { headers: { "Content-Type": "image/svg+xml" } })));
    const bare = await GET(new NextRequest("http://app.test/api/uploads/r%61w"), params(["uploads", "raw"]));
    expect(bare.headers.get("Content-Security-Policy")).toContain("sandbox");
    expect(bare.headers.get("X-Content-Type-Options")).toBe("nosniff");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { headers: { "Content-Security-Policy": "default-src 'none'; sandbox" } })),
    );
    const own = await GET(new NextRequest("http://app.test/api/uploads/raw"), params(["uploads", "raw"]));
    expect(own.headers.get("Content-Security-Policy")).toBe("default-src 'none'; sandbox");
  });

  it("keeps double-encoded dot segments inside /api/v1", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(url);
      return new Response("{}");
    }));
    await GET(new NextRequest("http://app.test/api/x"), params(["%2e%2e", "%2e%2e", "q", "health"]));
    expect(new URL(urls[0]).pathname.startsWith("/api/v1/")).toBe(true);
  });
});
