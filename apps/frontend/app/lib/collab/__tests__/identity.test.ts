import { describe, it, expect, beforeEach } from "vitest";
import { loadStoredName, storeName, makeGuestUser } from "../identity";

describe("collab identity", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips the stored name", () => {
    expect(loadStoredName()).toBeNull();
    storeName("  Alex  ");
    expect(loadStoredName()).toBe("Alex");
  });

  it("treats blank stored names as absent", () => {
    storeName("   ");
    expect(loadStoredName()).toBeNull();
  });

  it("mints a unverified guest user with a guest-prefixed id", () => {
    const u = makeGuestUser("  Sam ");
    expect(u.name).toBe("Sam");
    expect(u.id.startsWith("guest:")).toBe(true);
    expect(u.emailVerified).toBe(false);
    expect(u.email).toBe("");
    expect(typeof u.createdAt).toBe("string");
  });

  it("gives each guest a unique id", () => {
    const ids = new Set(
      Array.from({ length: 50 }, () => makeGuestUser("x").id),
    );
    expect(ids.size).toBe(50);
  });
});
