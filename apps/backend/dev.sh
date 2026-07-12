#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Colors ────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*"; }
info() { echo -e "${CYAN}[DEVS]${NC}  $*"; }

# ── Cleanup on Ctrl+C ─────────────────────────────────────────────
cleanup() {
    echo ""
    log "Shutting down dev environment..."
    pkill -P $$ 2>/dev/null || true
    wait 2>/dev/null || true
    log "Done."
}
trap cleanup EXIT INT TERM

# ── Prerequisites ─────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    err "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v mvn &>/dev/null; then
    err "Maven (mvn) is not found. Please install Maven or use ./mvnw."
    exit 1
fi

# ── Start Docker services ─────────────────────────────────────────
log "Starting PostgreSQL, MinIO, Mailpit, and Keycloak..."
docker compose up -d

log "Waiting for PostgreSQL to be ready..."
until docker compose exec -T postgres pg_isready -U survey -d survey &>/dev/null; do
    sleep 1
done
log "PostgreSQL is ready."

log "Waiting for MinIO to be ready..."
until docker compose exec -T minio mc ready local &>/dev/null; do
    sleep 1
done

# Create the survey bucket if it doesn't exist
docker compose exec -T minio mc mb --ignore-existing local/survey 2>/dev/null || true
log "MinIO is ready (bucket 'survey' ensured)."

log "Mailpit available at ${CYAN}http://localhost:8025${NC}"

# ── Wait for Keycloak ─────────────────────────────────────────────
log "Waiting for Keycloak to be ready..."
until curl -sf http://localhost:9900/health/ready &>/dev/null; do
    sleep 2
done
log "Keycloak is ready."

# ── Info ──────────────────────────────────────────────────────────
echo ""
info "═══════════════════════════════════════════════════════"
info "  PostgreSQL : localhost:5432  (survey / survey)"
info "  MinIO API  : localhost:9000  (minioadmin / minioadmin)"
info "  MinIO UI   : http://localhost:9001"
info "  Mailpit UI : http://localhost:8025"
info "  Keycloak   : http://localhost:8180  (admin / admin)"
info "  Keycloak Realm: survey-school"
info "═══════════════════════════════════════════════════════"
echo ""

# ── Start Quarkus dev ─────────────────────────────────────────────
log "Starting Quarkus in dev mode..."
mvn quarkus:dev
