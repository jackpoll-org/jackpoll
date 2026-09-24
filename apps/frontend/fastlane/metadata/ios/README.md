# iOS release notes

One folder per marketing version, one file per App Store locale, holding the
plain text that becomes **What's New in This Version**:

```
0.3/en-US.txt
0.3/de-DE.txt
```

The `app-store` job in `.github/workflows/mobile-release.yml` (and the manual
`ios-promote.yml`) writes them onto the version it submits. A version or locale
with no file gets a generic "Improvements and bug fixes." line, so a missing
file never blocks a release. Per version on purpose: one file per locale would
quietly ship the previous release's notes with the next one.

The version is picked automatically: once Apple approves a version, the next
build goes out as the next minor version (see `ios/release-testflight.sh`). Add
the folder for that version when you want real notes for it.

Keep them under 4000 characters. They are the only part of the listing the
pipeline touches. Description, keywords and screenshots live in App Store
Connect, because they change on their own schedule.

Apple rejects release notes on a **first** release, so they are only written
once the app has a version in `READY_FOR_SALE`.

The Play equivalent lives in `../android/<locale>/changelogs/<versionCode>.txt`.
