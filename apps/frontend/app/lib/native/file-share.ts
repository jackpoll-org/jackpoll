// ── Native-aware file saving (mobile-app) ───────────────────────────
//
// `<a download>` is silently ignored inside the iOS/Android WebView, so
// exports (CSV, QR codes…) that rely on it never save anything in the app.
// Inside Capacitor we instead write the file via Filesystem and hand it to
// the native Share sheet, which lets the user save it to Files/Photos or
// send it on. On the web this falls back to the existing anchor-click
// download.

import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

function anchorDownload(href: string, filename: string): void {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
}

async function shareWrittenFile(filename: string): Promise<void> {
  const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
  await Share.share({ url: uri, dialogTitle: filename });
}

/** Save UTF-8 text content (CSV, SVG…). */
export async function saveTextFile(filename: string, content: string, mime: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await shareWrittenFile(filename);
    return;
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  anchorDownload(url, filename);
  URL.revokeObjectURL(url);
}

/** Save a `data:` URL, e.g. `canvas.toDataURL("image/png")`. */
export async function saveDataUrlFile(filename: string, dataUrl: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
    await shareWrittenFile(filename);
    return;
  }
  anchorDownload(dataUrl, filename);
}
