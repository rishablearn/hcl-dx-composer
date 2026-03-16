#!/usr/bin/env bash

#===============================================================================
# HCL DX Composer - Deployment Script
# This script deploys the application using Docker Compose
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
# Detect Docker Compose command (v1 vs v2)
#-------------------------------------------------------------------------------
detect_compose() {
    if docker compose version &> /dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        print_error "Docker Compose not found"
        exit 1
    fi
    export COMPOSE_CMD
}

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
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --build, -b       Build images before starting"
            echo "  --foreground, -f  Run in foreground (don't detach)"
            echo "  --recreate, -r    Force recreate containers"
            echo "  --stop, -s        Stop running containers"
            echo "  --down, -d        Stop and remove containers"
            echo "  --restart         Restart all services"
            echo "  --logs, -l        Show container logs"
            echo "  --status          Show container status"
            echo "  --help, -h        Show this help message"
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
        docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" $($COMPOSE_CMD ps -q) 2>/dev/null || true
        ;;
esac
