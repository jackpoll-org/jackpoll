# Contributing to Jackpoll

Thanks for taking the time to contribute. This is the app monorepo — frontend
(Next.js + Capacitor) and backend (Quarkus) in one place.

## Before you start

For anything beyond a small fix (new feature, behavior change, dependency
bump), open an issue first to discuss the approach before writing code. Saves
everyone a wasted PR.

## Development setup

```bash
# Backend — infra + API (from apps/backend)
cd apps/backend
docker compose up -d          # Postgres, MinIO, Keycloak, Redis, Mailpit
./mvnw quarkus:dev            # API on http://localhost:8080

# Frontend — web app (from apps/frontend)
cd apps/frontend
pnpm install
pnpm dev                      # app on http://localhost:3000
```

See [apps/frontend/README.md](apps/frontend/README.md) and
[apps/backend/README.md](apps/backend/README.md) for details.

## Before opening a PR

```bash
# Backend
cd apps/backend
./mvnw test

# Frontend
cd apps/frontend
pnpm lint
pnpm test
```

CI runs the full suite on your PR (E2E, DB migrations, React Doctor, mobile
build, F-Droid FLOSS check where relevant) — path-filtered to whatever your
change touches. Fix anything CI flags before asking for review.

## PR guidelines

- Keep PRs focused — one change per PR is easier to review than five
  unrelated ones bundled together.
- Write a clear description of *why*, not just *what* — the diff already
  shows what changed.
- Match the existing code style; there's no separate style guide beyond what
  the linters (`eslint`, backend checkstyle if configured) enforce.
- Target `master` — that's the default branch.

## Reporting bugs / requesting features

Open a GitHub issue. Include repro steps for bugs (what you did, what you
expected, what happened instead) and, for the mobile app, which build
(Play/F-Droid/TestFlight) and OS version. Add a screenshot or screen
recording whenever possible — for UI bugs especially, it's often faster to
diagnose than a text description alone.

## Security issues

Do **not** open a public issue for a security vulnerability — see
[SECURITY.md](SECURITY.md).

## License

By contributing, you agree your contribution is licensed under this repo's
[MIT license](LICENSE).
