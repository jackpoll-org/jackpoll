import { NextResponse } from "next/server";

// Android App Links assetlinks.json (#71). Reached at /.well-known/assetlinks.json
// via a rewrite (next.config). Emitted only when the signing cert fingerprint(s)
// are set via ANDROID_CERT_FINGERPRINT (one or more SHA-256 fingerprints,
// comma-separated); otherwise 404.
export const dynamic = "force-dynamic";

const PACKAGE_NAME = process.env.ANDROID_PACKAGE_NAME || "de.quavon.surveyschool";

export function GET() {
  const raw = process.env.ANDROID_CERT_FINGERPRINT;
  if (!raw) {
    return new NextResponse("Not configured", { status: 404 });
  }
  const fingerprints = raw
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: PACKAGE_NAME,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    { headers: { "content-type": "application/json" } },
  );
}
