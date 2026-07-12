# Database migrations (Flyway)

The database schema is owned by **Flyway**, not by Hibernate. This lets the
schema evolve in production without losing data (issue #41).

## How it works per environment

| Profile        | Schema management                              | Flyway        |
|----------------|------------------------------------------------|---------------|
| `prod` (default) | Hibernate `validate` — boot fails on mismatch | migrate at start |
| `%dev`         | Hibernate `drop-and-create` (fast iteration)   | off           |
| `%test`        | Hibernate `drop-and-create`                    | off           |

- A **fresh** production database is provisioned entirely by `V1__baseline.sql`.
- An **existing** database (created before Flyway) is *baselined* at version 1
  (`baseline-on-migrate=true`) — the baseline is recorded, never re-run, so live
  tables are untouched.
- Keycloak shares the same database but owns its own tables; they are **not**
  part of these migrations.

## Adding a new migration

1. Change the JPA entities as usual.
2. Add a new file here named `V<n>__short_description.sql`, where `<n>` is the
   next integer (e.g. `V2__add_survey_archived_flag.sql`). Never edit an applied
   migration — append a new one.
3. Write the forward DDL (and any data backfill) in plain PostgreSQL SQL.
4. Keep the SQL and the entities in sync: prod boots with Hibernate `validate`,
   so a mismatch fails the deploy.
5. Verify locally against a throwaway database:

   ```bash
   docker run --rm -d --name mig-test -e POSTGRES_USER=survey \
     -e POSTGRES_PASSWORD=survey -e POSTGRES_DB=survey -p 5433:5432 postgres:16-alpine
   docker run --rm --network host \
     -v "$PWD/src/main/resources/db/migration:/flyway/sql:ro" flyway/flyway:10-alpine \
     -url=jdbc:postgresql://localhost:5433/survey -user=survey -password=survey migrate info
   docker rm -f mig-test
   ```

CI runs the same check (`.github/workflows/migrations.yml`) on every change to
this folder.

## Regenerating the baseline (rarely needed)

`V1__baseline.sql` was produced from the Hibernate-generated schema:

```bash
docker exec <postgres> pg_dump -U survey -d survey --schema-only --no-owner \
  --no-privileges -t public.surveys -t public.questions ... > V1__baseline.sql
# then strip any \restrict / \unrestrict psql meta-commands
```
