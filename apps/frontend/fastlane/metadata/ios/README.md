# iOS release notes

One file per App Store locale, named after the locale and holding the plain text
that becomes **What's New in This Version**:

```
en-US.txt
de-DE.txt
```

`.github/workflows/ios-promote.yml` reads them when an `ios-v*` tag is pushed and
writes them onto the version being submitted. A locale with no file is left
alone and logs a warning — the release still goes out.

Keep them under 4000 characters and rewrite them per release; they are the only
part of the listing the pipeline touches. Description, keywords and screenshots
live in App Store Connect, because they change on their own schedule and a job
that rewrote them on every tag would be a footgun.

Apple rejects release notes on a **first** release, so the promote job skips this
step until the app has a version in `READY_FOR_SALE`.

The Play equivalent lives in `../android/<locale>/changelogs/<versionCode>.txt`.
