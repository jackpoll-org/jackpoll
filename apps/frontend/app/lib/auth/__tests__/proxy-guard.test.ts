import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

function jwt(expSecondsFromNow: number): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const exp = Math.floor(Date.now() / 1000) + expSecondsFromNow;
  return `${b64({ alg: "RS256" })}.${b64({ exp })}.sig`;
}

function visit(path: string, token?: string) {
  const req = new NextRequest(new URL(path, "http://localhost:3000"));
  if (token) req.cookies.set("survey-auth-token", token);
  return proxy(req);
}

const location = (res: Response) => res.headers.get("location");

describe("proxy auth guard", () => {
  it("sends a signed-in user away from the login page", () => {
    expect(location(visit("/login", jwt(300)))).toBe("http://localhost:3000/");
  });

  // An expired token cookie left behind must not bounce /login back to "/":
  // "/" can't restore the session and sends the user to /login again — a loop.
  it("shows the login page when the token cookie has expired", () => {
    expect(location(visit("/login", jwt(-60)))).toBeNull();
  });

  it("still lets an expired token through to app pages, where the refresh cookie renews it", () => {
    expect(location(visit("/surveys", jwt(-60)))).toBeNull();
  });

  it("sends visitors without a token to login", () => {
    expect(location(visit("/surveys"))).toBe("http://localhost:3000/login?redirect=%2Fsurveys");
  });
});
