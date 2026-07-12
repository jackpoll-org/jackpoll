// Rasterise public/icons/icon.svg into the PNG sizes the PWA manifest and iOS
// need (issue: mobile app). Re-run after changing the source SVG:
//   node scripts/generate-pwa-icons.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(root, "..", "public", "icons");
const src = path.join(iconsDir, "icon.svg");

const BRAND = "#6d5ce7";

const targets = [
  { name: "icon-192.png", size: 192, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  { name: "icon-512.png", size: 512, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  // Maskable variants keep their own padding in the SVG; opaque-safe background.
  { name: "maskable-192.png", size: 192, background: BRAND },
  { name: "maskable-512.png", size: 512, background: BRAND },
  // iOS home-screen icon must be opaque (no alpha).
  { name: "apple-touch-icon.png", size: 180, background: BRAND },
];

const svg = await readFile(src);
await mkdir(iconsDir, { recursive: true });

for (const { name, size, background } of targets) {
  await sharp(svg, { density: 96, limitInputPixels: false })
    .resize(size, size, { fit: "contain", background })
    .flatten(background === BRAND ? { background } : false)
    .png()
    .toFile(path.join(iconsDir, name));
  console.log("wrote", name);
}
