#!/bin/bash

#===============================================================================
# HCL DX Composer - Initial Setup Script
# This script sets up the environment for first-time deployment
#===============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print banner
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           HCL DX Composer - Setup Script                     ║"
echo "║              Bharat Petroleum Digital Platform               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

#-------------------------------------------------------------------------------
# Function: Print step
#-------------------------------------------------------------------------------
print_step() {
    echo -e "\n${BLUE}▶ $1${NC}"
}

#-------------------------------------------------------------------------------
# Function: Print success
#-------------------------------------------------------------------------------
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

#-------------------------------------------------------------------------------
# Function: Print warning
#-------------------------------------------------------------------------------
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

#-------------------------------------------------------------------------------
# Function: Print error
#-------------------------------------------------------------------------------
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

#-------------------------------------------------------------------------------
# Check prerequisites
#-------------------------------------------------------------------------------
print_step "Checking prerequisites..."

# Check Docker
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | cut -d ' ' -f3 | cut -d ',' -f1)
    print_success "Docker installed (v$DOCKER_VERSION)"
else
    print_error "Docker is not installed. Please install Docker first."
    echo "  Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check Docker Compose
if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
    print_success "Docker Compose installed"
else
    print_error "Docker Compose is not installed."
    exit 1
fi

# Check if Docker is running
if docker info &> /dev/null; then
    print_success "Docker daemon is running"
else
    print_error "Docker daemon is not running. Please start Docker."
    exit 1
fi

# Check Node.js (optional, for local development)
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js installed ($NODE_VERSION)"
else
    print_warning "Node.js not found (optional, needed for local development)"
fi

#-------------------------------------------------------------------------------
# Create environment file
#-------------------------------------------------------------------------------
print_step "Setting up environment configuration..."

if [ -f ".env" ]; then
    print_warning ".env file already exists"
    read -p "Do you want to recreate it? (y/N): " recreate
    if [[ ! $recreate =~ ^[Yy]$ ]]; then
        print_success "Keeping existing .env file"
    else
        rm .env
    fi
fi

if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    
    # Generate random secrets
    JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
    SESSION_SECRET=$(openssl rand -base64 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
    DB_PASSWORD=$(openssl rand -base64 16 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 16 | head -n 1)

    cat > .env << EOF
#===============================================================================
# HCL DX Composer - Environment Configuration
# Generated on $(date)
#===============================================================================

# Environment
NODE_ENV=production

#-------------------------------------------------------------------------------
# Database Configuration
#-------------------------------------------------------------------------------
POSTGRES_DB=hcl_dx_staging
POSTGRES_USER=hcldx
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_PORT=5432

#-------------------------------------------------------------------------------
# Backend Configuration
#-------------------------------------------------------------------------------
BACKEND_PORT=3001
JWT_SECRET=${JWT_SECRET}
SESSION_SECRET=${SESSION_SECRET}

#-------------------------------------------------------------------------------
# Frontend Configuration
#-------------------------------------------------------------------------------
FRONTEND_PORT=3000
VITE_API_BASE_URL=http://localhost:3001/api

#-------------------------------------------------------------------------------
# LDAP/Active Directory Configuration
# Update these with your organization's LDAP settings
#-------------------------------------------------------------------------------
LDAP_URL=ldap://your-ad-server:389
LDAP_BASE_DN=DC=domain,DC=com
LDAP_BIND_DN=CN=ServiceAccount,OU=ServiceAccounts,DC=domain,DC=com
LDAP_BIND_PASSWORD=your_ldap_password
LDAP_USER_SEARCH_BASE=OU=Users,DC=domain,DC=com
LDAP_GROUP_SEARCH_BASE=OU=Groups,DC=domain,DC=com

#-------------------------------------------------------------------------------
# HCL DX Configuration
# Update these with your HCL DX server details
#-------------------------------------------------------------------------------
HCL_DX_HOST=your-dx-server.domain.com
HCL_DX_PORT=443
HCL_DX_PROTOCOL=https
HCL_DX_API_KEY=your_dx_api_key
HCL_DX_DAM_BASE_URL=https://your-dx-server/dx/api/dam/v1
HCL_DX_WCM_BASE_URL=https://your-dx-server/wps/mycontenthandler/wcmrest
HCL_DX_WCM_LIBRARY=Web Content

#-------------------------------------------------------------------------------
# LTPA2 SSO Configuration (Optional)
#-------------------------------------------------------------------------------
LTPA2_SECRET_KEY=
LTPA2_REALM=

#-------------------------------------------------------------------------------
# AI Image Generation (Optional)
# Get API keys from: https://platform.openai.com/ or https://stability.ai/
#-------------------------------------------------------------------------------
OPENAI_API_KEY=
STABILITY_API_KEY=
AI_IMAGE_PROVIDER=openai

#-------------------------------------------------------------------------------
# Upload Configuration
#-------------------------------------------------------------------------------
MAX_UPLOAD_SIZE=52428800
EOF

    print_success ".env file created"
    print_warning "Please update .env with your actual configuration values"
fi

#-------------------------------------------------------------------------------
# Create required directories
#-------------------------------------------------------------------------------
print_step "Creating required directories..."

mkdir -p uploads/ai-generated
mkdir -p uploads/thumbnails
mkdir -p logs

# Create .gitkeep files
touch uploads/.gitkeep
touch uploads/ai-generated/.gitkeep
touch uploads/thumbnails/.gitkeep
touch logs/.gitkeep

print_success "Directories created"

#-------------------------------------------------------------------------------
# Set permissions
#-------------------------------------------------------------------------------
print_step "Setting permissions..."

chmod +x scripts/*.sh 2>/dev/null || true
chmod 600 .env

print_success "Permissions set"

#-------------------------------------------------------------------------------
# Summary
#-------------------------------------------------------------------------------
echo -e "\n${GREEN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    Setup Complete!                           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "Next steps:"
echo -e "  1. ${YELLOW}Edit .env file${NC} with your configuration values"
echo -e "     - LDAP/Active Directory settings"
echo -e "     - HCL DX server details"
echo -e "     - AI API keys (optional)"
echo ""
echo -e "  2. ${YELLOW}Deploy the application${NC}:"
echo -e "     ${BLUE}./scripts/deploy.sh${NC}"
echo ""
echo -e "  3. ${YELLOW}For local development${NC}:"
echo -e "     ${BLUE}./scripts/dev.sh${NC}"
echo ""
echo -e "Documentation: ${BLUE}docs/HCL-DX-INTEGRATION.md${NC}"
echo ""
