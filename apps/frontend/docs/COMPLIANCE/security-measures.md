# Technical & Organisational Measures (GDPR Art. 32)

> TOMs for the SaaS deployment. Pairs with [OPERATIONS.md](../OPERATIONS.md)
> (secrets, backups, health) and the [RoPA](./ropa.md).
> **Last reviewed:** 2026-06-25.

## Encryption in transit

- **TLS everywhere at the edge:** Traefik terminates HTTPS for the app, API,
  Keycloak (`auth.survey.quavon.de`), and the collab websocket. HTTP→HTTPS
  upgrade enforced.
- **Internal traffic** stays on the Docker overlay network (not publicly
  routable).
- **Web Push payloads** are end-to-end encrypted (aes128gcm, RFC 8291) — the
  push service never sees plaintext.

## Encryption at rest

> **Action items — confirm + tick per deployment.**

- [ ] **PostgreSQL volume:** enable encryption at rest. Options (pick one):
      host-disk encryption (LUKS / dm-crypt) on the Swarm node, or an encrypted
      cloud block volume. Document which is in use.
- [ ] **MinIO bucket:** enable server-side encryption (SSE-S3 / SSE-KMS) for
      uploaded files (#3), **or** rely on encrypted host disk. Document choice.
- [ ] **Backups (#50):** `scripts/backup.sh` output (Postgres dumps + MinIO
      mirror) must be **encrypted at rest** and **in transit** to off-site
      storage — e.g. `age`/`gpg`-encrypt the dump before upload, transfer over
      TLS/SSH. Do **not** keep plaintext dumps off-site.
- **Credential hashes:** user passwords are hashed by Keycloak (never stored in
  plaintext / never in this app's DB).
- **Pseudonymisation:** respondent client identifiers are HMAC-hashed (#31) — no
  raw IP is stored.

## Secrets management

- Sensitive values are **Docker Swarm secrets** (#49): encrypted at rest by
  Swarm, mounted on tmpfs at `/run/secrets/*`, never in `docker inspect` or
  `.env`. Consumed via the `*_FILE` convention. Rotation = new secret +
  redeploy (see OPERATIONS.md).

## Access control & authentication

- **Keycloak OIDC** for all auth; access + refresh tokens, optional 2FA, optional
  biometric unlock on mobile (#54).
- **Refresh token** in an httpOnly, Secure, SameSite cookie on web; offline token
  in the device keychain on native.
- **"Log out of all devices" (#76)** revokes all sessions via the Keycloak admin
  API.
- **Authorisation:** role-based survey access (owner/editor/viewer, #8); every
  owner endpoint checks ownership server-side.

## Application hardening

- **Input validation:** Zod (client) + Bean Validation (backend) at boundaries.
- **XSS:** user-generated content sanitised; CSP `frame-ancestors 'self'`
  (embed widget intentionally framable, #7).
- **CSRF:** SameSite cookies + token checks.
- **Rate limiting & spam protection** on public endpoints (#31, HMAC tokens).
- **File uploads:** type/size validation; optional ClamAV scan (`CLAMAV_*`).
- **Clickjacking:** `X-Frame-Options: SAMEORIGIN` + CSP (non-embed routes).

## Availability & resilience

- Health checks for every service (orchestrator + reverse proxy).
- Daily backups, 14-dump retention (#50); **test restores periodically**.
- Redis for cache + collab fan-out; stateless app replicas behind Traefik.

## Organisational measures

- Least-privilege access to production; secrets known only to the operator.
- Dependency updates + security review on code changes.
- Breach process documented in [breach-response.md](./breach-response.md).
- Sub-processor DPAs tracked in [sub-processors.md](./sub-processors.md).

## Outstanding / review checklist

- [ ] Encryption-at-rest method chosen + documented (Postgres, MinIO, backups).
- [ ] Off-site backup encryption verified.
- [ ] Restore test performed (date: ____).
- [ ] Annual TOM review.
