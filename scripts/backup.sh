#!/usr/bin/env bash

#===============================================================================
# HCL DX Composer - Backup Script
# This script backs up the database and uploads
# Compatible with: macOS, Ubuntu, Debian, CentOS, RHEL, Fedora, Alpine
#===============================================================================

set -e

#-------------------------------------------------------------------------------
# Colors for output (with fallback for non-color terminals)
#-------------------------------------------------------------------------------
setup_colors() {
    if [[ -t 1 ]] && [[ "${TERM:-}" != "dumb" ]]; then
        RED='\033[0;31m'
        GREEN='\033[0;32m'
        YELLOW='\033[1;33m'
        BLUE='\033[0;34m'
        NC='\033[0m'
    else
        RED=''
        GREEN=''
        YELLOW=''
        BLUE=''
        NC=''
    fi
}

setup_colors

# Get script directory (POSIX compatible)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

cd "$PROJECT_DIR"

#-------------------------------------------------------------------------------
# Detect Docker Compose command (v1 vs v2)
#-------------------------------------------------------------------------------
detect_compose() {
    if docker compose version &> /dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        echo -e "${RED}Docker Compose not found${NC}"
        exit 1
    fi
    export COMPOSE_CMD
}

detect_compose

# Load environment
if [ -f ".env" ]; then
    set -a
    # shellcheck disable=SC1091
    . .env
    set +a
fi

echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           HCL DX Composer - Backup Script                    ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

#-------------------------------------------------------------------------------
# Database backup
#-------------------------------------------------------------------------------
echo -e "\n${BLUE}▶ Backing up database...${NC}"

DB_BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql"

$COMPOSE_CMD exec -T db pg_dump -U ${POSTGRES_USER:-hcldx} ${POSTGRES_DB:-hcl_dx_staging} > "$DB_BACKUP_FILE"

if [ -f "$DB_BACKUP_FILE" ]; then
    gzip "$DB_BACKUP_FILE"
    echo -e "${GREEN}✓ Database backed up: ${DB_BACKUP_FILE}.gz${NC}"
else
    echo -e "${YELLOW}⚠ Database backup failed${NC}"
fi

#-------------------------------------------------------------------------------
# Uploads backup
#-------------------------------------------------------------------------------
echo -e "\n${BLUE}▶ Backing up uploads...${NC}"

UPLOADS_BACKUP_FILE="$BACKUP_DIR/uploads_backup_$TIMESTAMP.tar.gz"

if [ -d "$PROJECT_DIR/uploads" ] && [ "$(ls -A $PROJECT_DIR/uploads 2>/dev/null)" ]; then
    tar -czf "$UPLOADS_BACKUP_FILE" -C "$PROJECT_DIR" uploads
    echo -e "${GREEN}✓ Uploads backed up: $UPLOADS_BACKUP_FILE${NC}"
else
    echo -e "${YELLOW}⚠ No uploads to backup${NC}"
fi

#-------------------------------------------------------------------------------
# Cleanup old backups (keep last 7 days)
#-------------------------------------------------------------------------------
echo -e "\n${BLUE}▶ Cleaning up old backups...${NC}"

find "$BACKUP_DIR" -name "*.gz" -mtime +7 -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete 2>/dev/null || true

echo -e "${GREEN}✓ Cleanup complete${NC}"

#-------------------------------------------------------------------------------
# Summary
#-------------------------------------------------------------------------------
echo -e "\n${GREEN}Backup complete!${NC}"
echo -e "Backup location: ${BLUE}$BACKUP_DIR${NC}"
ls -lh "$BACKUP_DIR" | tail -5
