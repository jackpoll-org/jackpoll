import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const publicDir = path.resolve(__dirname, "../../public");
const manifest: { icons: { src: string }[] } = JSON.parse(
  readFileSync(path.join(publicDir, "manifest.webmanifest"), "utf8"),
);

describe("PWA manifest", () => {
  it.each(manifest.icons.map((icon) => icon.src))("serves %s from public/", (src) => {
    expect(src.startsWith("/")).toBe(true);
    expect(existsSync(path.join(publicDir, src))).toBe(true);
  });
});
