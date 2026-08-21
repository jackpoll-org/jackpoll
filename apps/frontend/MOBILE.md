# Survey School — Mobile apps (iOS + Android)

The native apps wrap the **live web deployment** with [Capacitor](https://capacitorjs.com)
in `server.url` mode: one SSR build, one source of truth. Offline is handled by
the service worker (`public/sw.js`); native device features are added by
Capacitor plugins. This avoids maintaining a separate static export of the app.

## Architecture

```
iOS / Android (Capacitor shell)
        │  loads
        ▼
https://survey.quavon.de  ──►  /api proxy ──► Quarkus backend
        │
        ├─ service worker  → caches opened surveys, offline outbox (IndexedDB)
        └─ Capacitor bridge → Camera · Push · Biometric · Network
```

- **Online-after-first-visit offline**: open the app once online; surveys you've
  loaded then work offline and submissions queue + sync on reconnect.
- **Same origin** as the website, so the `/api` proxy and cookie auth just work —
  no extra CORS config.

## Develop

```bash
pnpm install
# Point the app at your machine instead of production (use your LAN IP):
CAP_SERVER_URL=http://192.168.x.x:3000 pnpm exec cap sync
pnpm dev                 # run the web app
pnpm ios                 # open/run in the iOS simulator (Xcode + CocoaPods-free SPM)
pnpm android             # run on an Android emulator/device (needs Android SDK)
```

Default `server.url` is `https://survey.quavon.de` (see `capacitor.config.ts`).

## Native features

| Feature | Plugin | Where |
|---|---|---|
| Camera capture | `@capacitor/camera` | "Take photo" on file-upload questions |
| Push notifications | UnifiedPush (native bridge) | resolves a distributor → Web Push endpoint → `POST /me/devices`; backend delivers via Web Push (VAPID) |
| Biometric unlock | `@aparajita/capacitor-biometric-auth` | Face ID / fingerprint gate on the dashboard |
| Connectivity | `@capacitor/network` | triggers the offline outbox sync |

## Icons & splash

Source art lives in `assets/` and `public/icons/icon.svg`.

```bash
pnpm mobile:icons                 # regenerate PWA PNGs from the SVG
npx capacitor-assets generate \   # regenerate native icon/splash sets
  --iconBackgroundColor '#6d5ce7' --splashBackgroundColor '#6d5ce7'
```

## Before publishing (manual, needs accounts)

1. **Push delivery** (UnifiedPush → Web Push): the backend delivers via **Web
   Push (VAPID)** — set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (generate once
   with `npx web-push generate-vapid-keys`). On Android the app registers through
   **UnifiedPush**; a distributor turns that into a Web Push endpoint. Two flavors:
   - **play**: bundles the **Embedded FCM distributor** (Google) so it works with
     no extra app. Needs a Firebase project — put its `google-services.json` at
     `android/app/src/play/google-services.json` (a placeholder is committed;
     replace it, or inject it in CI). The `google-services` plugin is applied
     **only** for `play` tasks.
   - **fdroid**: **no Google** — relies on an external distributor. Self-host
     ships an **ntfy** server; users point the app's distributor there. (See the
     jackpoll-selfhost repo.)

   **iOS uses APNs instead** (#51): a WKWebView has no Push API, so Web Push and
   UnifiedPush are both out. The app registers an APNs device token
   (`app/lib/native/apns.ts`) and the backend delivers it via `ApnsService`.
   Configure `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` (the `.p8`
   contents), `APNS_TOPIC` and `APNS_PRODUCTION` — create the key once under
   developer portal → Keys → Apple Push Notifications service. TestFlight and
   App Store builds need `APNS_PRODUCTION=true`; a locally built debug app needs
   `false`, since its entitlement points at the APNs sandbox.
2. **iOS**: signing is wired already — team `CFV35FGSHF` (Quavon UG), the
   entitlements file is linked via `CODE_SIGN_ENTITLEMENTS`, and signing runs
   through the Apple ID signed into Xcode (`-allowProvisioningUpdates`), so all
   you need is an App Store Connect API key for the upload. Locally:
   `cd ios && ASC_KEY_ID=… ASC_ISSUER_ID=… ./release-testflight.sh` (archive →
   export → TestFlight, no fastlane). In CI add the repo secrets `ASC_KEY_ID`,
   `ASC_ISSUER_ID`, `ASC_KEY_CONTENT` (base64 of the `.p8`); the `Mobile release`
   workflow then runs `bundle exec fastlane beta` — but its iOS job is **manual
   only**, because macOS runners cost 10× the Linux rate. `match` stays optional:
   set `MATCH_GIT_URL` + `MATCH_PASSWORD` for a shared signing repo, or
   `ASC_CLOUD_SIGNING=1` to sign with an **Admin**-role API key instead of the
   local Xcode account.
   For iOS push you also need an **APNs key** (see the push section above) and
   the Push Notifications capability on the App ID.
   Full store checklist: [docs/app-store-submission.md](./docs/app-store-submission.md).
3. **Android** (#52): create a release keystore, then add repo secrets
   `ANDROID_KEYSTORE_BASE64` (base64 of the `.jks`),
   `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
   The `Mobile release` workflow (tag `v*` or manual) then builds a **signed
   AAB** artifact. Locally: set the same `ANDROID_*` env vars and run
   `cd android && ./gradlew bundleRelease`. Upload the AAB to the Play Console
   (add an `r0adkll/upload-google-play` step with a Play service account to
   automate).
4. **Store metadata / privacy**: camera + notifications usage; no tracking.

## CI

`.github/workflows/mobile.yml` builds an unsigned **Android debug APK**
(artifact) on every change to the native projects.

The **iOS** jobs in both `mobile.yml` and `mobile-release.yml` are
`workflow_dispatch` only: GitHub bills macOS runners at 10× the Linux rate, and
there are no self-hosted macOS runners yet. Compile iOS locally instead:

```bash
cd ios/App && xcodebuild -scheme App \
  -destination 'generic/platform=iOS Simulator' \
  -configuration Debug CODE_SIGNING_ALLOWED=NO build
```
