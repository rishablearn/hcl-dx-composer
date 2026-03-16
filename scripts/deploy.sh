#!/usr/bin/env bash

#===============================================================================
# HCL DX Composer - Deployment Script
# 
# DESCRIPTION:
#   Deploy, manage, and monitor the HCL DX Composer application using Docker.
#   This script handles building, starting, stopping, and monitoring containers.
#
# USAGE:
#   ./scripts/deploy.sh [COMMAND] [OPTIONS]
#
# COMMANDS:
#   (default)     Start all services
#   start         Start all services (same as default)
#   stop          Stop all services gracefully
#   restart       Restart all services
#   status        Show service status and resource usage
#   logs          View container logs (use -f to follow)
#   rebuild       Rebuild and restart a specific service
#
# OPTIONS:
#   --build       Build/rebuild Docker images before starting
#   --force       Force recreate containers
#   -f, --follow  Follow log output (with logs command)
#   --help, -h    Show this help message
#
# EXAMPLES:
#   ./scripts/deploy.sh                    # Start all services
#   ./scripts/deploy.sh --build            # Build and start
#   ./scripts/deploy.sh stop               # Stop all services
#   ./scripts/deploy.sh logs -f            # Follow logs
#   ./scripts/deploy.sh rebuild backend    # Rebuild backend only
#   ./scripts/deploy.sh status             # Check service status
#
# PREREQUISITES:
#   - Docker and Docker Compose installed
#   - .env file configured (run setup.sh first)
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
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           HCL DX Composer - Deployment Script                ║"
echo "║              Bharat Petroleum Digital Platform               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

#-------------------------------------------------------------------------------
# Function: Print step
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

#-------------------------------------------------------------------------------
# Parse arguments
#-------------------------------------------------------------------------------
ACTION="up"
BUILD=false
DETACH=true
FORCE_RECREATE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --build|-b)
            BUILD=true
            shift
            ;;
        --foreground|-f)
            DETACH=false
            shift
            ;;
        --recreate|-r)
            FORCE_RECREATE=true
            shift
            ;;
        --stop|-s)
            ACTION="stop"
            shift
            ;;
        --down|-d)
            ACTION="down"
            shift
            ;;
        --restart)
            ACTION="restart"
            shift
            ;;
        --logs|-l)
            ACTION="logs"
            shift
            ;;
        --status)
            ACTION="status"
            shift
            ;;
        --help|-h)
            echo ""
            echo -e "${GREEN}HCL DX Composer - Deployment Script${NC}"
            echo ""
            echo -e "${CYAN}USAGE:${NC}"
            echo "  ./scripts/deploy.sh [OPTIONS]"
            echo ""
            echo -e "${CYAN}OPTIONS:${NC}"
            echo "  --build, -b       Build/rebuild Docker images before starting"
            echo "  --foreground, -f  Run in foreground (show logs, don't detach)"
            echo "  --recreate, -r    Force recreate all containers"
            echo "  --stop, -s        Stop running containers (preserves data)"
            echo "  --down, -d        Stop and remove containers (preserves volumes)"
            echo "  --restart         Restart all services"
            echo "  --logs, -l        Show container logs (add -f to follow)"
            echo "  --status          Show container status and resource usage"
            echo "  --help, -h        Show this help message"
            echo ""
            echo -e "${CYAN}EXAMPLES:${NC}"
            echo "  ./scripts/deploy.sh                # Start all services"
            echo "  ./scripts/deploy.sh --build        # Build and start (first time)"
            echo "  ./scripts/deploy.sh --stop         # Stop services"
            echo "  ./scripts/deploy.sh --logs         # View logs"
            echo "  ./scripts/deploy.sh --restart      # Restart services"
            echo ""
            echo -e "${CYAN}COMMON WORKFLOWS:${NC}"
            echo ""
            echo -e "  ${YELLOW}First time deployment:${NC}"
            echo "    1. ./scripts/setup.sh            # Configure environment"
            echo "    2. ./scripts/deploy.sh --build   # Build and start"
            echo ""
            echo -e "  ${YELLOW}Update application:${NC}"
            echo "    1. git pull                      # Get latest code"
            echo "    2. ./scripts/deploy.sh --build   # Rebuild and restart"
            echo ""
            echo -e "  ${YELLOW}Troubleshooting:${NC}"
            echo "    ./scripts/deploy.sh --logs       # Check logs"
            echo "    ./scripts/health-check.sh        # Check service health"
            echo ""
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

# Check .env file
if [ ! -f ".env" ]; then
    print_error ".env file not found. Please run setup.sh first."
    echo "  Run: ./scripts/setup.sh"
    exit 1
fi
print_success ".env file found"

# Check Docker
if ! docker info &> /dev/null; then
    print_error "Docker is not running. Please start Docker."
    exit 1
fi
print_success "Docker is running"

#-------------------------------------------------------------------------------
# Execute action
#-------------------------------------------------------------------------------
case $ACTION in
    up)
        print_step "Starting HCL DX Composer..."
        
        # Build Docker Compose command
        UP_CMD="$COMPOSE_CMD up"
        
        if [ "$BUILD" = true ]; then
            UP_CMD="$UP_CMD --build"
            print_warning "Building images (this may take a few minutes)..."
        fi
        
        if [ "$DETACH" = true ]; then
            UP_CMD="$UP_CMD -d"
        fi
        
        if [ "$FORCE_RECREATE" = true ]; then
            UP_CMD="$UP_CMD --force-recreate"
        fi
        
        # Execute
        eval $UP_CMD
        
        if [ "$DETACH" = true ]; then
            print_step "Waiting for services to be healthy..."
            sleep 5
            
            # Check health
            echo ""
            echo -e "${CYAN}Service Status:${NC}"
            $COMPOSE_CMD ps
            
            echo ""
            print_success "Deployment complete!"
            echo ""
            echo -e "Access the application:"
            echo -e "  ${BLUE}Frontend:${NC}    http://localhost:${FRONTEND_PORT:-3000}"
            echo -e "  ${BLUE}Backend API:${NC} http://localhost:${BACKEND_PORT:-3001}/api"
            echo -e "  ${BLUE}Health:${NC}      http://localhost:${BACKEND_PORT:-3001}/api/health"
            echo ""
            echo -e "View logs: ${YELLOW}./scripts/deploy.sh --logs${NC}"
        fi
        ;;
        
    stop)
        print_step "Stopping containers..."
        $COMPOSE_CMD stop
        print_success "Containers stopped"
        ;;
        
    down)
        print_step "Stopping and removing containers..."
        read -p "This will remove all containers. Continue? (y/N): " confirm
        if [[ $confirm =~ ^[Yy]$ ]]; then
            $COMPOSE_CMD down
            print_success "Containers removed"
        else
            print_warning "Cancelled"
        fi
        ;;
        
    restart)
        print_step "Restarting services..."
        $COMPOSE_CMD restart
        print_success "Services restarted"
        ;;
        
    logs)
        print_step "Showing logs (Ctrl+C to exit)..."
        $COMPOSE_CMD logs -f --tail=100
        ;;
        
    status)
        print_step "Service Status:"
        echo ""
        $COMPOSE_CMD ps
        echo ""
        
        # Show resource usage
        echo -e "${CYAN}Resource Usage:${NC}"
        $SUDO_CMD docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" $($COMPOSE_CMD ps -q) 2>/dev/null || true
        ;;
esac
