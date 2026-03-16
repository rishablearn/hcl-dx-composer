#!/usr/bin/env bash

#===============================================================================
# HCL DX Composer - Local Development Script
# 
# DESCRIPTION:
#   Run the application in development mode with hot-reloading.
#   This script starts the database in Docker and runs frontend/backend locally.
#
# USAGE:
#   ./scripts/dev.sh [MODE] [OPTIONS]
#
# MODES:
#   all       Run everything (database + backend + frontend) [default]
#   backend   Run only database and backend API
#   frontend  Run only frontend (assumes backend is running)
#   db        Run only database
#
# OPTIONS:
#   --install    Install npm dependencies before starting
#   --help, -h   Show this help message
#
# EXAMPLES:
#   ./scripts/dev.sh                    # Start full development environment
#   ./scripts/dev.sh --install          # Install dependencies and start
#   ./scripts/dev.sh backend            # Only run backend + database
#   ./scripts/dev.sh frontend           # Only run frontend
#
# PORTS (default):
#   Database:  5432 (PostgreSQL)
#   Backend:   3001 (Node.js Express)
#   Frontend:  3000 (Vite React)
#
# HOT RELOADING:
#   - Frontend: Changes to React components auto-refresh
#   - Backend: Changes to Node.js files auto-restart (nodemon)
#
# COMPATIBLE WITH:
#   macOS, Ubuntu, Debian, CentOS, RHEL, Fedora, Alpine Linux
#
# AUTHOR: HCL DX Composer Team
# VERSION: 2.0.0
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
        print_error "Docker Compose not found"
        exit 1
    fi
    export COMPOSE_CMD
}

detect_os
detect_docker_sudo
detect_compose

# Print banner
echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           HCL DX Composer - Development Mode                 ║"
echo "║              Bharat Petroleum Digital Platform               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

#-------------------------------------------------------------------------------
# Functions
#-------------------------------------------------------------------------------
print_step() {
    echo -e "\n${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

cleanup() {
    echo ""
    print_step "Shutting down development servers..."
    # Kill background processes
    [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
    # Stop database container
    $COMPOSE_CMD stop db 2>/dev/null || true
    print_success "Development servers stopped"
    exit 0
}

#-------------------------------------------------------------------------------
# Parse arguments
#-------------------------------------------------------------------------------
MODE="all"
INSTALL_DEPS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --backend|-b)
            MODE="backend"
            shift
            ;;
        --frontend|-f)
            MODE="frontend"
            shift
            ;;
        --db-only)
            MODE="db"
            shift
            ;;
        --install|-i)
            INSTALL_DEPS=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --backend, -b    Run only backend"
            echo "  --frontend, -f   Run only frontend"
            echo "  --db-only        Run only database"
            echo "  --install, -i    Install dependencies first"
            echo "  --help, -h       Show this help message"
            echo ""
            echo "Default: Runs database, backend, and frontend"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

#-------------------------------------------------------------------------------
# Check prerequisites
#-------------------------------------------------------------------------------
print_step "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi
NODE_VERSION=$(node --version)
print_success "Node.js $NODE_VERSION"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed."
    exit 1
fi
print_success "npm $(npm --version)"

# Check .env file
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating from template..."
    ./scripts/setup.sh
fi

# Load environment variables
set -a
source .env
set +a

#-------------------------------------------------------------------------------
# Install dependencies if requested
#-------------------------------------------------------------------------------
if [ "$INSTALL_DEPS" = true ]; then
    print_step "Installing dependencies..."
    
    echo "Installing backend dependencies..."
    cd "$PROJECT_DIR/backend"
    npm install
    
    echo "Installing frontend dependencies..."
    cd "$PROJECT_DIR/frontend"
    npm install
    
    cd "$PROJECT_DIR"
    print_success "Dependencies installed"
fi

#-------------------------------------------------------------------------------
# Start database
#-------------------------------------------------------------------------------
if [ "$MODE" = "all" ] || [ "$MODE" = "db" ] || [ "$MODE" = "backend" ]; then
    print_step "Starting PostgreSQL database..."
    
    # Check if database container exists
    if $COMPOSE_CMD ps db 2>/dev/null | grep -q -E "(Up|running)"; then
        print_success "Database already running"
    else
        $COMPOSE_CMD up -d db
        print_warning "Waiting for database to be ready..."
        sleep 5
        
        # Wait for database to be healthy
        MAX_RETRIES=30
        RETRY_COUNT=0
        while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
            if $COMPOSE_CMD exec -T db pg_isready -U ${POSTGRES_USER:-hcldx} &>/dev/null; then
                print_success "Database is ready"
                break
            fi
            RETRY_COUNT=$((RETRY_COUNT + 1))
            sleep 1
        done
        
        if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
            print_warning "Database may not be fully ready, but continuing..."
        fi
    fi
fi

if [ "$MODE" = "db" ]; then
    echo ""
    echo -e "Database running on port ${YELLOW}${POSTGRES_PORT:-5432}${NC}"
    echo -e "Connection string: ${BLUE}postgresql://${POSTGRES_USER:-hcldx}:****@localhost:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-hcl_dx_staging}${NC}"
    echo ""
    echo "Press Ctrl+C to stop the database"
    $COMPOSE_CMD logs -f db
    exit 0
fi

#-------------------------------------------------------------------------------
# Setup trap for cleanup
#-------------------------------------------------------------------------------
trap cleanup SIGINT SIGTERM

#-------------------------------------------------------------------------------
# Start backend
#-------------------------------------------------------------------------------
if [ "$MODE" = "all" ] || [ "$MODE" = "backend" ]; then
    print_step "Starting backend server..."
    
    cd "$PROJECT_DIR/backend"
    
    # Check if dependencies are installed
    if [ ! -d "node_modules" ]; then
        print_warning "Installing backend dependencies..."
        npm install
    fi
    
    # Export database connection for local dev
    export DB_HOST=localhost
    export DB_PORT=${POSTGRES_PORT:-5432}
    export DB_NAME=${POSTGRES_DB:-hcl_dx_staging}
    export DB_USER=${POSTGRES_USER:-hcldx}
    export DB_PASSWORD=${POSTGRES_PASSWORD:-hcldx_secure_password}
    export PORT=${BACKEND_PORT:-3001}
    export NODE_ENV=development
    export UPLOAD_PATH="$PROJECT_DIR/uploads"
    
    npm run dev &
    BACKEND_PID=$!
    
    cd "$PROJECT_DIR"
    sleep 3
    
    if kill -0 $BACKEND_PID 2>/dev/null; then
        print_success "Backend running on http://localhost:${PORT:-3001}"
    else
        print_error "Backend failed to start"
        exit 1
    fi
fi

#-------------------------------------------------------------------------------
# Start frontend
#-------------------------------------------------------------------------------
if [ "$MODE" = "all" ] || [ "$MODE" = "frontend" ]; then
    print_step "Starting frontend server..."
    
    cd "$PROJECT_DIR/frontend"
    
    # Check if dependencies are installed
    if [ ! -d "node_modules" ]; then
        print_warning "Installing frontend dependencies..."
        npm install
    fi
    
    export VITE_API_BASE_URL=http://localhost:${BACKEND_PORT:-3001}/api
    
    npm run dev &
    FRONTEND_PID=$!
    
    cd "$PROJECT_DIR"
    sleep 3
    
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        print_success "Frontend running on http://localhost:${FRONTEND_PORT:-3000}"
    else
        print_error "Frontend failed to start"
        exit 1
    fi
fi

#-------------------------------------------------------------------------------
# Summary
#-------------------------------------------------------------------------------
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Development Environment Ready!                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Services running:"
if [ "$MODE" = "all" ] || [ "$MODE" = "backend" ]; then
    echo -e "  ${BLUE}Database:${NC}    postgresql://localhost:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-hcl_dx_staging}"
    echo -e "  ${BLUE}Backend:${NC}     http://localhost:${BACKEND_PORT:-3001}"
    echo -e "  ${BLUE}API Docs:${NC}    http://localhost:${BACKEND_PORT:-3001}/api/health"
fi
if [ "$MODE" = "all" ] || [ "$MODE" = "frontend" ]; then
    echo -e "  ${BLUE}Frontend:${NC}    http://localhost:${FRONTEND_PORT:-3000}"
fi
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for processes
wait
