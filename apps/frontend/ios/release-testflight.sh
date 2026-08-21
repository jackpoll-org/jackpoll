#!/usr/bin/env bash
# Build a signed App Store archive locally and upload it to TestFlight.
#
# Same result as the `Mobile release` CI job, but without fastlane (the system
# Ruby is too old for it) — plain xcodebuild + altool, cloud-managed signing.
#
# Prerequisites (one-time):
#   0. Xcode signed in with an Apple ID on the team (Settings → Accounts) and an
#      "Apple Distribution" certificate in the keychain (Manage Certificates → +).
#      Set ASC_CLOUD_SIGNING=1 to sign via the API key instead — that needs a key
#      with the *Admin* role, App Manager cannot create certs or profiles.
#   1. App Store Connect → Users and Access → Integrations → App Store Connect
#      API → generate a key with the "App Manager" role (uploads). Download the
#      .p8 ONCE.
#   2. mkdir -p ~/.appstoreconnect/private_keys
#      mv ~/Downloads/AuthKey_<KEYID>.p8 ~/.appstoreconnect/private_keys/
#   3. The app record must already exist in App Store Connect for the bundle id.
#
# Usage:
#   export ASC_KEY_ID=XXXXXXXXXX ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
#   ./release-testflight.sh              # build + upload
#   SKIP_UPLOAD=1 ./release-testflight.sh   # build + validate only
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(dirname "$SCRIPT_DIR")"

APP_IDENTIFIER="${IOS_APP_IDENTIFIER:-de.quavon.jackpoll}"
TEAM_ID="${IOS_TEAM_ID:-CFV35FGSHF}"

BUILD_DIR="$SCRIPT_DIR/build"
ARCHIVE_PATH="$BUILD_DIR/App.xcarchive"
EXPORT_DIR="$BUILD_DIR/export"
KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID:-missing}.p8"

: "${ASC_KEY_ID:?set ASC_KEY_ID (App Store Connect API key id)}"
: "${ASC_ISSUER_ID:?set ASC_ISSUER_ID (App Store Connect issuer id)}"
[ -f "$KEY_PATH" ] || { echo "error: API key not found at $KEY_PATH" >&2; exit 1; }

# The marketing version defines the "train"; build numbers must be unique and
# strictly increasing within it, and may restart at 1 in a new train.
MARKETING_VERSION="$(sed -n 's/.*MARKETING_VERSION = \(.*\);/\1/p' \
  "$SCRIPT_DIR/App/App.xcodeproj/project.pbxproj" | head -1)"

# Next build number = highest one App Store Connect already has for this train,
# plus one. Asking the store rather than counting CI runs keeps local and CI
# builds on one sequence, and starts a fresh train at 1.
next_build_number() {
  local jwt app_id builds
  jwt="$(xcrun altool --generate-jwt --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID" \
    --p8-file-path "$KEY_PATH" 2>&1 | grep -m1 -oE 'ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+')"
  [ -n "$jwt" ] || { echo "error: could not mint an App Store Connect token" >&2; return 1; }

  app_id="$(curl -fsS -H "Authorization: Bearer $jwt" \
    "https://api.appstoreconnect.apple.com/v1/apps?filter%5BbundleId%5D=$APP_IDENTIFIER&limit=1" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin)["data"]; print(d[0]["id"] if d else "")')"
  [ -n "$app_id" ] || { echo "error: no app record for $APP_IDENTIFIER" >&2; return 1; }

  builds="$(curl -fsS -H "Authorization: Bearer $jwt" \
    "https://api.appstoreconnect.apple.com/v1/builds?filter%5Bapp%5D=$app_id&filter%5BpreReleaseVersion.version%5D=$MARKETING_VERSION&limit=200")"
  # Compare numerically: "10" must beat "9", which a string sort gets wrong.
  python3 -c '
import json, sys
builds = json.load(sys.stdin).get("data", [])
numbers = [int(b["attributes"]["version"]) for b in builds
           if b["attributes"].get("version", "").isdigit()]
print(max(numbers) + 1 if numbers else 1)' <<<"$builds"
}

BUILD_NUMBER="${IOS_BUILD_NUMBER:-$(next_build_number)}"
[ -n "$BUILD_NUMBER" ] || { echo "error: could not determine the build number" >&2; exit 1; }

echo "==> Syncing web assets into the native project"
(cd "$FRONTEND_DIR" && pnpm exec cap sync ios)

# Signing source. By default xcodebuild uses the Apple ID signed into Xcode,
# which may create certificates and profiles. Passing the API key instead
# ("cloud signing") only works if the key has the *Admin* role — an App Manager
# key fails with "Cloud signing permission error / No profiles were found".
SIGNING_ARGS=(-allowProvisioningUpdates)
if [ -n "${ASC_CLOUD_SIGNING:-}" ]; then
  SIGNING_ARGS+=(
    -authenticationKeyPath "$KEY_PATH"
    -authenticationKeyID "$ASC_KEY_ID"
    -authenticationKeyIssuerID "$ASC_ISSUER_ID"
  )
fi

echo "==> Archiving ($APP_IDENTIFIER, build $BUILD_NUMBER, team $TEAM_ID)"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
xcodebuild archive \
  -project "$SCRIPT_DIR/App/App.xcodeproj" \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  "${SIGNING_ARGS[@]}" \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER"
# NB: never pass PRODUCT_BUNDLE_IDENTIFIER (or DEVELOPMENT_TEAM) here — a build
# setting on the command line applies to *every* target in the build, including
# SPM dependencies like IONCameraLib, which then ship with the app's identifier
# and Apple rejects the package with "CFBundleIdentifier Collision" (409).

cat > "$BUILD_DIR/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>app-store-connect</string>
	<key>teamID</key>
	<string>$TEAM_ID</string>
	<key>signingStyle</key>
	<string>automatic</string>
	<key>uploadSymbols</key>
	<true/>
	<key>destination</key>
	<string>export</string>
</dict>
</plist>
PLIST

echo "==> Exporting signed .ipa"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist "$BUILD_DIR/ExportOptions.plist" \
  "${SIGNING_ARGS[@]}"

IPA="$(find "$EXPORT_DIR" -name '*.ipa' -maxdepth 1 | head -1)"
[ -n "$IPA" ] || { echo "error: no .ipa produced in $EXPORT_DIR" >&2; exit 1; }
echo "==> Built $IPA"

echo "==> Validating with App Store Connect"
xcrun altool --validate-app -f "$IPA" -t ios \
  --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"

if [ -n "${SKIP_UPLOAD:-}" ]; then
  echo "==> SKIP_UPLOAD set — stopping before upload."
  exit 0
fi

echo "==> Uploading to TestFlight"
xcrun altool --upload-app -f "$IPA" -t ios \
  --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"

echo "==> Done. Build $BUILD_NUMBER is processing in App Store Connect."
