# Operations (production swarm)

## Secrets (#49)

Sensitive values are **Swarm secrets**, not environment variables — they are
encrypted at rest, mounted at `/run/secrets/*` (tmpfs), and never appear in
`docker inspect` or `.env.swarm`.

**Create them once in Portainer** (*Swarm → Secrets → Add secret*) with these
exact names:

| Secret name | Holds |
|---|---|
| `survey_db_password` | Postgres password (DB, backend, Keycloak) |
| `survey_minio_secret` | MinIO root password / S3 secret key |
| `survey_keycloak_client_secret` | survey-backend OIDC client secret |
| `survey_spam_secret` | HMAC key for spam tokens (#31) |

The stack references them as `external: true`, so deploy **after** they exist.
Containers consume them via the `*_FILE` convention (Postgres/MinIO natively;
the backend image and the Keycloak entrypoint export `FOO_FILE → FOO` on start).
To rotate: create a new secret (e.g. `survey_db_password_v2`), point the stack at
it, redeploy (Swarm secrets are immutable).

## Health

All services expose health for the orchestrator + reverse proxy:

- **backend** — Quarkus SmallRye Health at `/q/health/live` and
  `/q/health/ready` (readiness includes the DB). Used by the compose
  healthcheck; scrape it from monitoring too.
- **postgres** — `pg_isready`
- **redis** — `redis-cli ping`
- **minio** — `mc ready local`
- **keycloak** — `KC_HEALTH_ENABLED=true`

## Backups (#50)

`scripts/backup.sh` dumps Postgres (`pg_dump`) and mirrors the MinIO bucket to
`./backups`, keeping the last 14 DB dumps. Run on the swarm manager and
schedule via cron:

```cron
0 3 * * *  cd /opt/survey && STACK=survey DB_USERNAME=survey DB_NAME=survey \
  MINIO_BUCKET=survey-uploads ./scripts/backup.sh >> /var/log/survey-backup.log 2>&1
```

Restore steps are documented at the top of `scripts/backup.sh`. Store backups
off-box (e.g. sync `./backups` to object storage / another host).
