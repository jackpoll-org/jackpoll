// Rasterise public/icons/icon.svg into the PNG sizes the PWA manifest and iOS
// need (issue: mobile app). Re-run after changing the source SVG:
//   node scripts/generate-pwa-icons.mjs
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(root, "..", "public", "icons");
const src = path.join(iconsDir, "icon.svg");

// The logo is blue on a white tile, matching the native launcher background.
const BACKGROUND = "#ffffff";

const targets = [
  { name: "icon-192.png", size: 192, scale: 0.8 },
  { name: "icon-512.png", size: 512, scale: 0.8 },
  // Maskable icons get cropped to the 80% safe-zone circle, so the leaf needs more room.
  { name: "maskable-192.png", size: 192, scale: 0.6 },
  { name: "maskable-512.png", size: 512, scale: 0.6 },
  { name: "apple-touch-icon.png", size: 180, scale: 0.8 },
];

const svg = await readFile(src);
await mkdir(iconsDir, { recursive: true });

for (const { name, size, scale } of targets) {
  const inner = Math.round(size * scale);
  const start = Math.floor((size - inner) / 2);
  const end = size - inner - start;
  await sharp(svg, { density: 96, limitInputPixels: false })
    .resize(inner, inner, { fit: "contain", background: BACKGROUND })
    .extend({ top: start, bottom: end, left: start, right: end, background: BACKGROUND })
    .flatten({ background: BACKGROUND })
    .png()
    .toFile(path.join(iconsDir, name));
  console.log("wrote", name);
}
