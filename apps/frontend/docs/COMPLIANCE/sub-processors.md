# Sub-processors & DPAs (GDPR Art. 28)

> **Template — fill the operator-specific fields (`«…»`) before publishing.**
> This lists every processor that may handle personal data on the controller's
> behalf. Under Art. 28 a Data Processing Agreement (DPA) must be in place with
> each external processor; under Art. 30 they also feed the
> [Records of Processing](./ropa.md).

**Controller:** Quavon UG (haftungsbeschränkt), Langbehnstraße 39, 83022 Rosenheim,
Germany — contact@quavon.de. See [Impressum](/impressum).
**Last reviewed:** 2026-10-19.

> The SaaS deployment at `app.jackpoll.org` processes and stores data **on
> servers in Germany**. Third-country transfers only happen through the
> *optional* push channels below, and only for users who enable notifications.

## What counts as a sub-processor here

Jackpoll is self-hostable. Many "processors" below are **components we run
ourselves** on the hosting provider's servers (Postgres, Keycloak, MinIO,
Redis, ClamAV). For those the hosting provider is the relevant external
sub-processor, not the software.

## Processors

| Processor | Role / purpose | Data categories | Location | DPA |
|---|---|---|---|---|
| **netcup GmbH**, Daimlerstraße 25, 76185 Karlsruhe (external) | Servers running the Docker Swarm (compute, storage volumes, network) | All data at rest/in transit on the host | Germany | **Required** — netcup AVV |
| **PostgreSQL** (self-run) | Primary datastore: accounts, surveys, responses, device tokens | Account email/name, survey content, responses, hashed client IDs | On host volume | n/a (self-run) — covered by hosting DPA |
| **Keycloak** (self-run) | Identity & access (OIDC), password hashes, sessions | Email, name, credential hashes, session metadata | On host volume | n/a (self-run) |
| **MinIO / S3** (self-run) | File-upload storage (#3) | Respondent-uploaded files, signatures, survey images | On host bucket | n/a (self-run) |
| **Redis** (self-run) | Rate limiting, collab and live-results pub/sub | Transient keys incl. IP-based rate-limit buckets (expire with the window) | On host | n/a (self-run) |
| **ClamAV** (self-run, optional) | Malware scan of uploads | File content, scanned in memory | On host | n/a (self-run) |
| **Mail server** (self-run on netcup) | Transactional email: verification, password reset, receipts, notifications | Recipient email address, email body | Germany | n/a (self-run) — covered by hosting DPA |
| **Browser push services** (external, optional) | Web Push delivery (#74) — Google, Mozilla, Apple endpoints chosen by the browser | Push endpoint, encrypted payload | EU/US | Transport only; payload is E2E-encrypted (aes128gcm); US transfers under the EU-US DPF |
| **Apple Push Notification service** (external, optional) | iOS push delivery (#51) | APNs device token, notification title/body (survey title, names) | Apple (US) | Apple Developer terms + DPF/SCCs |
| **Google FCM** (external, optional, Play build only) | Fallback UnifiedPush distributor on Android | Push endpoint, encrypted payload | Google (US) | Google DPA + DPF/SCCs |

The website analytics (Rybbit) runs self-hosted at `tracker.quavon.de` on the
landing site only; the app sends nothing to it.

## Notes

- **No third-party analytics** in the app. Survey owners get cookieless,
  aggregate counters for their own surveys.
- **IP addresses** are used only transiently for rate limiting; spam protection
  stores an HMAC-hashed client identifier only for surveys limited to one
  response per browser (#31).
- **Deletion:** unreferenced uploads are removed by a nightly sweep after a
  7-day grace period; expired drafts and notifications older than 90 days are
  purged daily.
- Push is **optional/env-gated** — a minimal self-host deployment can avoid
  external sub-processors entirely.

## DPA checklist

- [ ] netcup AVV signed
- [ ] Apple / Google terms reviewed for push (if enabled)
- [ ] This list reviewed at least annually and on every new processor
