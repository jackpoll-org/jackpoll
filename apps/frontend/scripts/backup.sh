#!/usr/bin/env bash
# Backup the Survey School stateful services (#50): Postgres + MinIO.
#
# Run on the swarm manager (where postgres/minio are pinned). Writes timestamped
# archives to $BACKUP_DIR (default ./backups). Schedule via cron, e.g.:
#   0 3 * * *  /opt/survey/scripts/backup.sh >> /var/log/survey-backup.log 2>&1
#
# Restore (Postgres):
#   gunzip -c db-YYYImmdd.sql.gz | docker exec -i <postgres-cid> \
#     psql -U "$DB_USERNAME" -d "$DB_NAME"
# Restore (MinIO): mc mirror backups/minio-YYYYmmdd/ local/<bucket>
set -euo pipefail

STACK="${STACK:-survey}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_NAME="${DB_NAME:-survey}"
DB_USERNAME="${DB_USERNAME:-survey}"
MINIO_BUCKET="${MINIO_BUCKET:-survey-uploads}"
TS="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

cid() { docker ps -qf "name=${STACK}_$1" | head -n1; }

PG="$(cid postgres)"
[ -n "$PG" ] || { echo "postgres container not found"; exit 1; }

echo "[backup] postgres → $BACKUP_DIR/db-$TS.sql.gz"
docker exec "$PG" pg_dump -U "$DB_USERNAME" -d "$DB_NAME" | gzip > "$BACKUP_DIR/db-$TS.sql.gz"

MINIO="$(cid minio)"
if [ -n "$MINIO" ]; then
  echo "[backup] minio bucket '$MINIO_BUCKET' → $BACKUP_DIR/minio-$TS"
  docker exec "$MINIO" sh -c \
    "mc alias set local http://localhost:9000 \"\$MINIO_ROOT_USER\" \"\$MINIO_ROOT_PASSWORD\" >/dev/null 2>&1 \
     && mc mirror --quiet --overwrite local/$MINIO_BUCKET /tmp/backup-$TS"
  docker cp "$MINIO:/tmp/backup-$TS" "$BACKUP_DIR/minio-$TS"
  docker exec "$MINIO" rm -rf "/tmp/backup-$TS"
fi

# Retain the 14 most recent DB dumps.
ls -1t "$BACKUP_DIR"/db-*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
echo "[backup] done: $TS"
