#!/bin/bash

#===============================================================================
# HCL DX Composer - Health Check Script
# This script checks the health of all services
#===============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Load environment
if [ -f ".env" ]; then
    set -a
    source .env
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

# Database
if docker-compose ps db 2>/dev/null | grep -q "Up"; then
    echo -e "  Database (PostgreSQL):  ${GREEN}● Running${NC}"
else
    echo -e "  Database (PostgreSQL):  ${RED}○ Stopped${NC}"
fi

# Backend
if docker-compose ps backend 2>/dev/null | grep -q "Up"; then
    echo -e "  Backend (Node.js):      ${GREEN}● Running${NC}"
else
    echo -e "  Backend (Node.js):      ${RED}○ Stopped${NC}"
fi

# Frontend
if docker-compose ps frontend 2>/dev/null | grep -q "Up"; then
    echo -e "  Frontend (React):       ${GREEN}● Running${NC}"
else
    echo -e "  Frontend (React):       ${RED}○ Stopped${NC}"
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
DB_HEALTH=$(docker-compose exec -T db pg_isready -U ${POSTGRES_USER:-hcldx} 2>/dev/null && echo "ok" || echo "fail")
if [ "$DB_HEALTH" = "ok" ]; then
    echo -e "  Database:               ${GREEN}● Accepting connections${NC}"
else
    echo -e "  Database:               ${RED}○ Not accepting connections${NC}"
fi

#-------------------------------------------------------------------------------
# Resource usage
#-------------------------------------------------------------------------------
echo ""
echo -e "${BLUE}Resource Usage:${NC}"
echo "─────────────────────────────────────────────────────────────────"

docker stats --no-stream --format "  {{.Name}}:\t{{.CPUPerc}}\t{{.MemUsage}}" $(docker-compose ps -q 2>/dev/null) 2>/dev/null || echo "  No containers running"

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
