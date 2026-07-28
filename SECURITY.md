# Security Policy

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report privately instead:

- Preferred: [GitHub Security Advisories](https://github.com/jackpoll-org/jackpoll/security/advisories/new)
  (private, keeps the report and any discussion out of public view until fixed).
- Or email [contact@jackpoll.org](mailto:contact@jackpoll.org).

Include what you can: affected component (frontend, backend, mobile app),
steps to reproduce, and impact. We'll acknowledge within a few days.

## Scope

This covers the Jackpoll application (this repo) and the self-hosting stack
in [jackpoll-selfhost](https://github.com/jackpoll-org/jackpoll-selfhost).
Third-party dependencies should be reported upstream, though we'd still like
to know if one affects a deployed instance.

## Supported versions

Jackpoll doesn't currently maintain multiple release lines — fixes land on
`master` and ship in the next published image. If you're running an older
self-hosted version, update to the latest `ghcr.io/jackpoll-org/*` image tag.
