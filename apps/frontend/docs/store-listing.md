# Jackpoll — Store submission notes (Play + F-Droid)

Package: **de.quavon.jackpoll** · Privacy policy: **https://app.jackpoll.org/privacy**

---

## 7. Privacy policy

- Public URL: **https://app.jackpoll.org/privacy** (also reachable in-app: Settings → legal).
- Push section updated: UnifiedPush (browser push / chosen distributor such as ntfy);
  the Play build may use a bundled Google FCM fallback, the F-Droid build has no Google services.
- Optional email verification (`EMAIL_VERIFICATION_REQUIRED`): **no privacy change** — it only
  controls whether a verification email is sent; it collects no additional personal data.

## 8. Data safety (Play Console form)

| Data type | Collected | Shared | Encrypted in transit | Deletion possible | Purpose |
|---|---|---|---|---|---|
| Email address | Yes | No | Yes (HTTPS) | Yes (delete account) | Account, sign-in, notifications |
| Name / username | Yes | No | Yes | Yes | Account, collaboration display |
| Survey content & responses | Yes | No | Yes | Yes (per-survey retention + account delete) | App functionality |
| UnifiedPush endpoint URL + keys | Yes (only if notifications enabled) | With the user's chosen push distributor (e.g. ntfy) / Google FCM only in Play fallback | Yes; Web Push payloads E2E-encrypted | Yes (turn off / unregister) | Deliver notifications |
| Uploaded images/files | Yes (if the user uploads) | No | Yes | Yes | Survey images |
| Diagnostics/logs (server) | Minimal (error logs) | No | Yes | n/a (transient) | Reliability |
| Approx. device info | No collection by the app | — | — | — | — |
| Location / contacts / identifiers | No | — | — | — | — |

Notes for the form: account creation **required**; data is **not sold**; users can **request deletion**
in-app (Settings → Delete account, GDPR Art. 17). No advertising identifiers.

### Account/data deletion URLs (Play Console → App content → Data safety)

- **Account deletion URL:** `https://app.jackpoll.org/delete-account` — public, no login required.
  Enter the account's email + password, then confirm with a 6-digit code emailed to that address.
  Permanently deletes the account, surveys, responses and uploaded files (GDPR Art. 17).
- **Data deletion URL** (delete some data without deleting the account): `https://app.jackpoll.org/delete-data`
  — same email + password + emailed code flow, but only erases content (surveys, responses,
  uploaded files); the account and login stay active. Both pages are also linked from the
  privacy policy (§8).

## 9. Store listing texts

### English
- **Short description (≤80):** `Open-source surveys & quizzes — build, share, analyze. Self-hostable.` (72)
- **Full description (≤4000):** see `fastlane/metadata/android/en-US/full_description.txt`.

### Deutsch
- **Kurzbeschreibung (≤80):** `Open-Source-Umfragen & Quizze — erstellen, teilen, auswerten. Self-hostbar.` (74)
- **Ausführliche Beschreibung:**
  > Jackpoll ist ein quelloffenes Tool zum Erstellen, Teilen und Auswerten von Umfragen und Quizzen — eine datenschutzfreundliche, selbst hostbare Alternative zu geschlossenen Umfrage-Plattformen.
  >
  > Erstelle Umfragen mit einem Drag-and-drop-Builder, führe bewertete Quizze durch, sammle Antworten und sieh Ergebnisse in Echtzeit-Diagrammen. Alles ist Open Source, und du kannst deine eigene Instanz betreiben.
  >
  > Funktionen:
  > • Drag-and-drop-Umfrage-Builder mit Seiten und Logik
  > • Fragetypen: Kurzantwort, Multiple Choice, Kontrollkästchen, Dropdown, Raster, Ranking
  > • Quiz-Modus mit richtigen Antworten, Punkten und automatischer Bewertung
  > • Echtzeit-Ergebnisse mit Diagrammen und CSV-Export
  > • Zusammenarbeit mit Rollen und Berechtigungen
  > • Öffentliche Freigabe-Links und einbettbare Umfragen
  > • Push-Benachrichtigungen über UnifiedPush — in der F-Droid-Variante ohne Google
  >
  > Datenschutz & Offenheit: 100 % Open Source (MIT), selbst hostbar, keine Werbung. Die F-Droid-Variante enthält keine Google-Play-Dienste.
  >
  > Die App ist ein Client für einen Jackpoll-Server — nutze die offizielle Instanz oder deine eigene.

### Keywords (ASO)
`survey, quiz, forms, poll, questionnaire, open source, self-hosted, privacy, GDPR, feedback, umfrage, fragebogen, abstimmung`

## 10. Graphic assets — checklist

| Asset | Required size | Status |
|---|---|---|
| Hi-res app icon | 512×512 PNG | ✅ reuse `public/icons/icon-512.png` |
| Feature graphic | 1024×500 PNG/JPG | ❌ **missing — must be created** |
| Phone screenshots (≥2) | 16:9 / 9:16, ≥320px | ❌ **missing — only desktop web screenshots exist** (`docs/assets/screenshot-*.png` are desktop 2880×1800). Capture real phone-portrait shots. |
| Tablet screenshots (optional) | — | ⬜ optional |

Place Play screenshots under `fastlane/metadata/android/en-US/images/phoneScreenshots/` and the
feature graphic at `fastlane/metadata/android/en-US/images/featureGraphic.png` for Fastlane upload.

## 11. Ads declaration

**No ads.** No advertising SDKs are present (no AdMob / AppLovin / Unity Ads / IronSource / etc.).
Declare "This app contains no ads" in Play Console.

## 12. Content rating / target audience

Answer the IARC questionnaire roughly as:
- Violence / sexual / drugs / gambling: **No**.
- **User-generated content / user interaction:** **Yes** — users create surveys and can share links;
  respondents submit free-text answers. (Content is not public social feed; sharing is link-based.)
- Personal info shared with others: only what a user puts in a survey they share.
- Expected result: **PEGI 3 / ESRB Everyone**, possibly with a "Users Interact / Shares Info" notice
  due to user-generated content. Target age group: **13+** recommended (account + UGC).
