# Records of Processing Activities (GDPR Art. 30 / VVT)

> Verzeichnis von Verarbeitungstätigkeiten. Filled for the SaaS deployment at
> `survey.quavon.de`; adjust for self-hosted instances. Review at least annually
> and on any material change.

**Controller (Verantwortlicher):** Leopold Link (Quavon), Langbehnstraße 39,
83022 Rosenheim, Germany — contact@quavon.de, +49 (0) 175 4251056.
**Data Protection Officer:** not required (Art. 37) — contact above for all
data-protection matters.
**Last reviewed:** 2026-06-25.

Sub-processors are listed in [sub-processors.md](./sub-processors.md);
security measures in [security-measures.md](./security-measures.md).

---

## A. Account & authentication

- **Purpose:** create and manage user accounts; sign-in, password reset, email
  verification, optional 2FA.
- **Data subjects:** registered users (survey owners/editors).
- **Data categories:** email, display name, credential hash, session/login
  metadata, notification preferences, device push tokens.
- **Legal basis:** Art. 6(1)(b) (contract — providing the service).
- **Recipients:** Keycloak (identity), SMTP provider (transactional email).
- **Retention:** for the life of the account; deleted on account erasure
  (Art. 17, self-service "Delete account").
- **Transfers:** none (German servers).

## B. Survey authoring

- **Purpose:** let owners create, edit and publish surveys/quizzes.
- **Data subjects:** survey owners/editors/collaborators.
- **Data categories:** survey content, settings, collaborator associations.
- **Legal basis:** Art. 6(1)(b).
- **Recipients:** PostgreSQL (self-run); Redis for live co-editing relay (#85).
- **Retention:** until the owner deletes the survey or their account.

## C. Survey responses (respondent data)

- **Purpose:** collect and aggregate responses; quiz scoring; optional receipts.
- **Data subjects:** respondents (often anonymous).
- **Data categories:** answer content; *optional* respondent email for receipts
  (#24, opt-in); uploaded files/signatures (#3); HMAC-hashed client identifier
  for spam protection (#31 — no raw IP stored).
- **Legal basis:** the **survey owner is controller** for response content and
  sets the basis (Art. 6(1)(a) consent or (f) legitimate interest) via the
  per-survey privacy notice (#63); Quavon acts as processor for hosting it.
  Receipts: Art. 6(1)(a) (explicit opt-in).
- **Recipients:** PostgreSQL; MinIO/S3 (files); SMTP (receipts).
- **Retention:** per-survey retention window (#64) — responses past it are
  auto-deleted/anonymised; otherwise until the survey/account is deleted.

## D. Transactional email

- **Purpose:** verification, password reset, response receipts (#24).
- **Data categories:** recipient email, message content.
- **Legal basis:** Art. 6(1)(b); receipts Art. 6(1)(a).
- **Recipients:** SMTP provider (sub-processor).
- **Retention:** not stored beyond send (provider logs per their policy).

## E. Push notifications (optional)

- **Purpose:** notify owners of new responses (#46/#74).
- **Data categories:** device push token / Web Push subscription.
- **Legal basis:** Art. 6(1)(a) (the user enables notifications).
- **Recipients:** Google FCM (native) / browser push services (web) — only when
  configured. Web Push payloads are end-to-end encrypted (aes128gcm).
- **Retention:** until the device unregisters or the token is reported stale.

## F. Analytics

- **Purpose:** aggregate product usage.
- **Data categories:** non-personal, cookieless metrics (Rybbit, German
  servers) — no cross-site tracking, no profiling.
- **Legal basis:** Art. 6(1)(f) (legitimate interest); no consent needed as no
  personal data / no cookies.
- **Retention:** per Rybbit aggregate retention.

## G. Security & abuse prevention

- **Purpose:** spam/abuse prevention, rate limiting, audit.
- **Data categories:** HMAC-hashed client id (#31), request metadata, logs.
- **Legal basis:** Art. 6(1)(f).
- **Retention:** short-lived; logs rotated.
