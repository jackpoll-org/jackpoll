// ── Native camera capture (mobile-app phase 3) ─────────────────────
//
// Lets respondents take a photo directly for file-upload questions when running
// inside the iOS/Android app. On the web this is unused — the existing
// <input type="file"> handles selection (and mobile browsers already offer the
// camera there).

import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

/** True only inside the Capacitor native shell. */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Open the camera and return the captured photo as a File ready for upload,
 * or null if the user cancelled.
 */
export async function capturePhoto(): Promise<File | null> {
  const photo = await Camera.getPhoto({
    quality: 80,
    resultType: CameraResultType.Uri,
    source: CameraSource.Camera,
    allowEditing: false,
  });
  if (!photo.webPath) return null;

  const blob = await fetch(photo.webPath).then((r) => r.blob());
  const format = photo.format || "jpeg";
  const type = blob.type || `image/${format === "jpg" ? "jpeg" : format}`;
  return new File([blob], `photo-${Date.now()}.${format}`, { type });
}
