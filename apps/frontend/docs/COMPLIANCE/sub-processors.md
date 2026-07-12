# Sub-processors & DPAs (GDPR Art. 28)

> **Template — fill the operator-specific fields (`«…»`) before publishing.**
> This lists every processor that may handle personal data on the controller's
> behalf. Under Art. 28 a Data Processing Agreement (DPA) must be in place with
> each external processor; under Art. 30 they also feed the
> [Records of Processing](./ropa.md).

**Controller:** Leopold Link (Quavon), Langbehnstraße 39, 83022 Rosenheim,
Germany — contact@quavon.de. See [Impressum](/impressum).
**Last reviewed:** 2026-06-25.

> The SaaS deployment processes and stores data **exclusively on German
> servers, with no third-country transfer** — except the *optional* push
> channels below (Google FCM / browser push services), which are only active
> when `PUSH_ENABLED` / VAPID are configured.

## What counts as a sub-processor here

Jackpoll is self-hostable. Many "processors" below are **components you run
yourself** on your own infrastructure (Postgres, Keycloak, MinIO, Redis). When
self-hosted, the hosting/infrastructure provider is the relevant external
sub-processor, not the software. The SaaS deployment at `survey.quavon.de` uses
the providers marked **external**.

## Processors

| Processor | Role / purpose | Data categories | Location | DPA |
|---|---|---|---|---|
| **«Hosting/IaaS provider»** (external) | Runs the Docker Swarm (compute, storage volumes, network) | All data at rest/in transit on the host | Germany | **Required** — sign the provider's DPA |
| **Rybbit** (external) | Cookieless web analytics (#34) | Aggregate, non-personal usage metrics (no cookies, German servers) | Germany | DPA — privacy-friendly, no PII / no third-country transfer |
| **PostgreSQL** (self-run) | Primary datastore: accounts, surveys, responses, device tokens | Account email/name, survey content, responses, hashed client IDs | On host volume | n/a (self-run) — covered by hosting DPA |
| **Keycloak** (self-run) | Identity & access (OIDC), password hashes, sessions | Email, name, credential hashes, session metadata | On host volume | n/a (self-run) |
| **MinIO / S3** (self-run or external) | File-upload storage (#3) | Respondent-uploaded files, signatures | On host bucket / «S3 region» | Required **if** using external S3 |
| **Redis** (self-run) | Ephemeral cache + collab pub/sub (#85) | Transient session/collab data (no durable PII) | On host | n/a (self-run) |
| **SMTP provider** (external) | Transactional email: verification, password reset, receipts (#24) | Recipient email address, email body | «provider/region» | **Required** |
| **Google FCM** (external, optional) | Native push delivery (#46/#69) — only if `PUSH_ENABLED` | Device push token, notification title/body | Google (US, SCCs) | **Required** — Google Cloud DPA + SCCs |
| **Browser push services** (external, optional) | Web Push delivery (#74) — Apple/Mozilla/Google endpoints | Push endpoint, encrypted payload | Various | Transport only; payload is E2E-encrypted (aes128gcm) |
| **«CDN / reverse proxy»** if any | TLS termination / edge | IP, request metadata | «region» | Required if external |

## Notes

- **Analytics is cookieless and self-hosted** (#34) — no third-party analytics
  processor (no Google Analytics, etc.). See the privacy policy cookie section.
- **IP addresses** are not stored raw; spam protection uses an HMAC-hashed
  client identifier (#31).
- Push (FCM) and external S3/SMTP are **optional** and env-gated — a minimal
  self-host deployment can avoid those external sub-processors entirely.

## DPA checklist

- [ ] Hosting/IaaS provider DPA signed
- [ ] SMTP provider DPA signed
- [ ] Google Cloud DPA + SCCs accepted (if `PUSH_ENABLED`)
- [ ] External S3 DPA signed (if not self-hosting MinIO)
- [ ] This list reviewed at least annually and on every new processor
