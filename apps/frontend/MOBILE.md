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
| Push notifications | `@capacitor/push-notifications` | registers token → `POST /me/devices`; backend sends on new responses (FCM) |
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

1. **Push delivery** (FCM HTTP v1): create a Firebase project; add
   `google-services.json` (Android) + APNs key (iOS); download a **service
   account** JSON and point the backend at it via `FCM_SERVICE_ACCOUNT` (inline
   JSON or a mounted file path) + `PUSH_ENABLED=true`. Until then registration
   works but nothing is delivered.
2. **iOS** (#51): in Xcode set the signing team and add the **Push
   Notifications** capability (links `ios/App/App/App.entitlements`). For
   automated TestFlight builds set up `fastlane match` (a private signing repo)
   and add repo secrets `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_CONTENT`
   (base64 of the App Store Connect API key `.p8`), `MATCH_GIT_URL`,
   `MATCH_PASSWORD`. The `Mobile release` workflow then runs
   `bundle exec fastlane beta` (build → TestFlight). Locally:
   `cd ios && bundle install && bundle exec fastlane beta`.
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
(artifact) and compiles the **iOS** project for the simulator on every change to
the native projects. Signed release builds are intentionally excluded until
signing secrets are configured.
