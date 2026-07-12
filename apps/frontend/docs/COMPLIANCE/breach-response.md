# Data Breach Response Runbook (GDPR Art. 33 / 34)

> Process for detecting, assessing, and notifying a personal-data breach.
> **The 72-hour clock to notify the supervisory authority starts when the
> controller becomes _aware_ of a breach** (Art. 33(1)).

**Controller / responsible:** Leopold Link (Quavon) — contact@quavon.de,
+49 (0) 175 4251056.
**Competent supervisory authority:** Bayerisches Landesamt für Datenschutz­auf­sicht
(BayLDA), Promenade 18, 91522 Ansbach — https://www.lda.bayern.de (online breach
report form). Confirm jurisdiction for the controller's seat (Bavaria) at
incident time.
**Last reviewed:** 2026-06-25.

## 0. Definitions

A **personal-data breach** = a breach of security leading to accidental or
unlawful destruction, loss, alteration, unauthorised disclosure of, or access
to, personal data (Art. 4(12)). Includes: DB/MinIO exfiltration, leaked
credentials/secrets, ransomware, accidental public exposure, lost backups,
mis-sent email containing personal data.

## 1. Detect & contain (immediately)

- [ ] Record **date/time of awareness** (starts the 72h clock).
- [ ] Assign an incident lead (default: the controller).
- [ ] **Contain:** rotate affected secrets (Swarm secrets — see
      [OPERATIONS.md](../OPERATIONS.md)), revoke sessions
      (`POST /auth/logout-all` per user / Keycloak realm logout), isolate the
      affected service, take forensic copies before remediation where possible.
- [ ] Preserve logs (do not wipe) for assessment.

## 2. Assess the risk

- [ ] **What** data categories + how many data subjects (see [RoPA](./ropa.md)).
- [ ] **Confidentiality / integrity / availability** impact.
- [ ] Was the data **encrypted / pseudonymised**? (e.g. hashed client ids #31,
      credential hashes) — may lower the risk and remove the Art. 34 duty.
- [ ] Likely consequences (identity theft, fraud, distress, reputational harm).
- [ ] Risk level: **none / low → high**.

## 3. Notify the supervisory authority — within 72h (Art. 33)

Unless the breach is **unlikely to result in a risk** to data subjects:

- [ ] Submit to **BayLDA** within 72h of awareness (online form). If full detail
      isn't ready, submit an initial report and follow up "without undue
      further delay" (Art. 33(4)).
- [ ] Include: nature of breach, categories + approximate numbers of subjects
      and records, contact point, likely consequences, measures taken/proposed.
- [ ] If **>72h late**, include reasons for the delay.

## 4. Notify affected data subjects — when high risk (Art. 34)

- [ ] If **high risk** to rights/freedoms, notify affected users **without undue
      delay**, in clear language: what happened, likely consequences, measures,
      contact point, recommended steps (e.g. change password).
- [ ] Exemptions (Art. 34(3)): data was encrypted, risk mitigated afterwards, or
      disproportionate effort → use a public notice instead.
- [ ] **Survey-response breaches:** the **survey owner is controller** for their
      respondents' data — notify the affected owners so they can fulfil their
      Art. 34 duty toward respondents.

## 5. Document (Art. 33(5) — mandatory regardless of notification)

Log **every** breach (even non-notifiable ones) in the register below.

## 6. Post-incident review

- [ ] Root cause + corrective actions; update [security-measures.md](./security-measures.md).
- [ ] Verify secret rotation + backups integrity.

---

## Breach register (template)

| ID | Date aware | Description | Data categories | # subjects | Risk | Authority notified (date) | Users notified (date) | Status |
|----|-----------|-------------|-----------------|-----------|------|--------------------------|----------------------|--------|
| | | | | | | | | |
