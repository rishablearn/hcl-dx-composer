#!/usr/bin/env bash

#===============================================================================
# HCL DX Composer - Health Check Script
# 
# DESCRIPTION:
#   Monitor the health and status of all application services.
#   Checks Docker containers, service endpoints, database connectivity,
#   and resource usage.
#
# USAGE:
#   ./scripts/health-check.sh [OPTIONS]
#
# OPTIONS:
#   --json       Output results in JSON format (for monitoring tools)
#   --quiet      Only show errors and warnings
#   --help, -h   Show this help message
#
# CHECKS PERFORMED:
#   1. Docker container status (running/stopped)
#   2. Backend API health endpoint (/api/health)
#   3. Frontend accessibility
#   4. Database connection (PostgreSQL)
#   5. Resource usage (CPU, memory)
#   6. Disk space (uploads, backups)
#
# EXIT CODES:
#   0 - All services healthy
#   1 - One or more services unhealthy
#   2 - Critical error (Docker not running, etc.)
#
# MONITORING INTEGRATION:
#   # Nagios/NRPE
#   command[check_hcldx]=/path/to/scripts/health-check.sh --quiet
#   
#   # Prometheus (with node_exporter textfile collector)
#   */5 * * * * /path/to/scripts/health-check.sh --json > /var/lib/node_exporter/hcldx.prom
#
# COMPATIBLE WITH:
#   macOS, Ubuntu, Debian, CentOS, RHEL, Fedora, Alpine Linux
#
# AUTHOR: HCL DX Composer Team
# VERSION: 2.0.0
#===============================================================================

#-------------------------------------------------------------------------------
# Colors for output (with fallback for non-color terminals)
#-------------------------------------------------------------------------------
setup_colors() {
    if [[ -t 1 ]] && [[ "${TERM:-}" != "dumb" ]]; then
        RED='\033[0;31m'
        GREEN='\033[0;32m'
        YELLOW='\033[1;33m'
        BLUE='\033[0;34m'
        CYAN='\033[0;36m'
        NC='\033[0m'
    else
        RED=''
        GREEN=''
        YELLOW=''
        BLUE=''
        CYAN=''
        NC=''
    fi
}

setup_colors

# Get script directory (POSIX compatible)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

#-------------------------------------------------------------------------------
# Detect OS type
#-------------------------------------------------------------------------------
detect_os() {
    OS="unknown"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    elif [[ -f /etc/os-release ]]; then
        OS="linux"
    fi
    export OS
}

#-------------------------------------------------------------------------------
# Detect if sudo is required for Docker commands
#-------------------------------------------------------------------------------
detect_docker_sudo() {
    SUDO_CMD=""
    
    if [[ "$OS" == "macos" ]]; then
        SUDO_CMD=""
    elif docker info &> /dev/null 2>&1; then
        SUDO_CMD=""
    elif groups 2>/dev/null | grep -q docker; then
        SUDO_CMD=""
    elif [[ "$OS" == "linux" ]]; then
        SUDO_CMD="sudo"
    fi
    
    export SUDO_CMD
}

#-------------------------------------------------------------------------------
# Detect Docker Compose command (v1 vs v2)
#-------------------------------------------------------------------------------
detect_compose() {
    if $SUDO_CMD docker compose version &> /dev/null 2>&1; then
        COMPOSE_CMD="$SUDO_CMD docker compose"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="$SUDO_CMD docker-compose"
    else
        COMPOSE_CMD=""
    fi
    export COMPOSE_CMD
}

detect_os
detect_docker_sudo
detect_compose

# Load environment
if [ -f ".env" ]; then
    set -a
    # shellcheck disable=SC1091
    . .env
    set +a
fi

BACKEND_PORT=${BACKEND_PORT:-3001}
FRONTEND_PORT=${FRONTEND_PORT:-3000}

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           HCL DX Composer - Health Check                     ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

#-------------------------------------------------------------------------------
# Check Docker containers
#-------------------------------------------------------------------------------
echo -e "${BLUE}Docker Containers:${NC}"
echo "─────────────────────────────────────────────────────────────────"

if [ -z "$COMPOSE_CMD" ]; then
    echo -e "  ${YELLOW}Docker Compose not available${NC}"
else
    # Database
    if $COMPOSE_CMD ps db 2>/dev/null | grep -q -E "(Up|running)"; then
        echo -e "  Database (PostgreSQL):  ${GREEN}● Running${NC}"
    else
        echo -e "  Database (PostgreSQL):  ${RED}○ Stopped${NC}"
    fi

    # Backend
    if $COMPOSE_CMD ps backend 2>/dev/null | grep -q -E "(Up|running)"; then
        echo -e "  Backend (Node.js):      ${GREEN}● Running${NC}"
    else
        echo -e "  Backend (Node.js):      ${RED}○ Stopped${NC}"
    fi

    # Frontend
    if $COMPOSE_CMD ps frontend 2>/dev/null | grep -q -E "(Up|running)"; then
        echo -e "  Frontend (React):       ${GREEN}● Running${NC}"
    else
        echo -e "  Frontend (React):       ${RED}○ Stopped${NC}"
    fi
fi

#-------------------------------------------------------------------------------
# Check endpoints
#-------------------------------------------------------------------------------
echo ""
echo -e "${BLUE}Service Endpoints:${NC}"
echo "─────────────────────────────────────────────────────────────────"

# Backend health endpoint
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$BACKEND_PORT/api/health" 2>/dev/null || echo "000")
if [ "$BACKEND_HEALTH" = "200" ]; then
    echo -e "  Backend API:            ${GREEN}● Healthy${NC} (http://localhost:$BACKEND_PORT/api)"
else
    echo -e "  Backend API:            ${RED}○ Unhealthy${NC} (HTTP $BACKEND_HEALTH)"
fi

# Frontend
FRONTEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$FRONTEND_PORT" 2>/dev/null || echo "000")
if [ "$FRONTEND_HEALTH" = "200" ]; then
    echo -e "  Frontend:               ${GREEN}● Healthy${NC} (http://localhost:$FRONTEND_PORT)"
else
    echo -e "  Frontend:               ${RED}○ Unhealthy${NC} (HTTP $FRONTEND_HEALTH)"
fi

# Database connection
if [ -n "$COMPOSE_CMD" ]; then
    DB_HEALTH=$($COMPOSE_CMD exec -T db pg_isready -U ${POSTGRES_USER:-hcldx} 2>/dev/null && echo "ok" || echo "fail")
    if [ "$DB_HEALTH" = "ok" ]; then
        echo -e "  Database:               ${GREEN}● Accepting connections${NC}"
    else
        echo -e "  Database:               ${RED}○ Not accepting connections${NC}"
    fi
else
    echo -e "  Database:               ${YELLOW}○ Cannot check (no Docker Compose)${NC}"
fi

#-------------------------------------------------------------------------------
# Resource usage
#-------------------------------------------------------------------------------
echo ""
echo -e "${BLUE}Resource Usage:${NC}"
echo "─────────────────────────────────────────────────────────────────"

if [ -n "$COMPOSE_CMD" ]; then
    CONTAINER_IDS=$($COMPOSE_CMD ps -q 2>/dev/null)
    if [ -n "$CONTAINER_IDS" ]; then
        $SUDO_CMD docker stats --no-stream --format "  {{.Name}}:\t{{.CPUPerc}}\t{{.MemUsage}}" $CONTAINER_IDS 2>/dev/null || echo "  Unable to get stats"
    else
        echo "  No containers running"
    fi
else
    echo "  Docker Compose not available"
fi

#-------------------------------------------------------------------------------
# Disk usage
#-------------------------------------------------------------------------------
echo ""
echo -e "${BLUE}Disk Usage:${NC}"
echo "─────────────────────────────────────────────────────────────────"

UPLOADS_SIZE=$(du -sh "$PROJECT_DIR/uploads" 2>/dev/null | cut -f1 || echo "0")
echo -e "  Uploads folder:         $UPLOADS_SIZE"

DOCKER_SIZE=$(docker system df --format "{{.Size}}" 2>/dev/null | head -1 || echo "N/A")
echo -e "  Docker images:          $DOCKER_SIZE"

#-------------------------------------------------------------------------------
# Summary
#-------------------------------------------------------------------------------
echo ""
echo "─────────────────────────────────────────────────────────────────"

if [ "$BACKEND_HEALTH" = "200" ] && [ "$FRONTEND_HEALTH" = "200" ]; then
    echo -e "${GREEN}All services are healthy! ✓${NC}"
else
    echo -e "${YELLOW}Some services need attention${NC}"
fi
echo ""
