# F-Droid

`de.quavon.jackpoll.yml` is the build recipe for [fdroiddata](https://gitlab.com/fdroid/fdroiddata).
It builds the `fdroid` flavor from the public repo at a `v<versionName>` tag.

## Verified locally (2026-09-24)

- `fdroid lint`: clean.
- `fdroid scanner` on the source tree after the recipe's install steps (Debian
  container, pinned Node 22.23.3): 0 problems with the listed `scandelete` paths.
  Everything it deletes lives in `node_modules` and is build tooling that never
  reaches the APK.
- `gradlew assembleFdroidRelease` from that cleaned tree: builds.
- `fdroid scanner` on the APK: no non-free classes, no extra signing blocks.
- `fdroidReleaseRuntimeClasspath`: no Google Play Services / Firebase.

## Why the build is Google-free

- Android push is UnifiedPush (users pick a distributor such as ntfy).
- `@capacitor/push-notifications` is Firebase on Android, so
  `capacitor.config.ts` leaves it out of Android builds (it is iOS/APNs only).
- The Play flavor's embedded FCM distributor is `playImplementation` only.

## Releasing an update

1. Raise `versionCode` and `versionName` in `android/app/build.gradle`.
2. Add `fastlane/metadata/android/<locale>/changelogs/<versionCode>.txt`.
3. Push. The OSS sync tags the public repo with `v<versionName>`, and F-Droid's
   update checker (`UpdateCheckMode: Tags ^v[0-9.]+$`) builds it automatically.

## Submitting (one time)

Needs a GitLab account.

1. Fork https://gitlab.com/fdroid/fdroiddata.
2. Copy `de.quavon.jackpoll.yml` to `metadata/de.quavon.jackpoll.yml` in the fork.
3. Commit as `New app: Jackpoll` and open a merge request against `master`.
   Mention: Capacitor app, UnifiedPush for notifications, `fdroid` flavor only.
4. The fdroiddata CI builds it; answer reviewer questions in the MR.

Store texts, icon and changelogs come from `fastlane/metadata/android/` in the
source repo. Phone screenshots can be added under
`fastlane/metadata/android/en-US/images/phoneScreenshots/`.
