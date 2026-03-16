#!/bin/bash

#===============================================================================
# HCL DX Composer - Deployment Script
# This script deploys the application using Docker Compose
#===============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

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
        COMPOSE_CMD="docker-compose up"
        
        if [ "$BUILD" = true ]; then
            COMPOSE_CMD="$COMPOSE_CMD --build"
            print_warning "Building images (this may take a few minutes)..."
        fi
        
        if [ "$DETACH" = true ]; then
            COMPOSE_CMD="$COMPOSE_CMD -d"
        fi
        
        if [ "$FORCE_RECREATE" = true ]; then
            COMPOSE_CMD="$COMPOSE_CMD --force-recreate"
        fi
        
        # Execute
        eval $COMPOSE_CMD
        
        if [ "$DETACH" = true ]; then
            print_step "Waiting for services to be healthy..."
            sleep 5
            
            # Check health
            echo ""
            echo -e "${CYAN}Service Status:${NC}"
            docker-compose ps
            
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
        docker-compose stop
        print_success "Containers stopped"
        ;;
        
    down)
        print_step "Stopping and removing containers..."
        read -p "This will remove all containers. Continue? (y/N): " confirm
        if [[ $confirm =~ ^[Yy]$ ]]; then
            docker-compose down
            print_success "Containers removed"
        else
            print_warning "Cancelled"
        fi
        ;;
        
    restart)
        print_step "Restarting services..."
        docker-compose restart
        print_success "Services restarted"
        ;;
        
    logs)
        print_step "Showing logs (Ctrl+C to exit)..."
        docker-compose logs -f --tail=100
        ;;
        
    status)
        print_step "Service Status:"
        echo ""
        docker-compose ps
        echo ""
        
        # Show resource usage
        echo -e "${CYAN}Resource Usage:${NC}"
        docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" $(docker-compose ps -q) 2>/dev/null || true
        ;;
esac
