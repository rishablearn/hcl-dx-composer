#!/usr/bin/env bash

#===============================================================================
# HCL DX Composer - Initial Setup Script
# This script sets up the environment for first-time deployment
# Compatible with: macOS, Ubuntu, Debian, CentOS, RHEL, Fedora, Alpine
#===============================================================================

set -e

#-------------------------------------------------------------------------------
# Detect OS and Distribution
#-------------------------------------------------------------------------------
detect_os() {
    OS="unknown"
    DISTRO="unknown"
    PKG_MANAGER="unknown"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        DISTRO="macos"
        PKG_MANAGER="brew"
    elif [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS="linux"
        DISTRO="${ID:-unknown}"
        
        # Detect package manager
        if command -v apt-get &> /dev/null; then
            PKG_MANAGER="apt"
        elif command -v dnf &> /dev/null; then
            PKG_MANAGER="dnf"
        elif command -v yum &> /dev/null; then
            PKG_MANAGER="yum"
        elif command -v apk &> /dev/null; then
            PKG_MANAGER="apk"
        elif command -v pacman &> /dev/null; then
            PKG_MANAGER="pacman"
        elif command -v zypper &> /dev/null; then
            PKG_MANAGER="zypper"
        fi
    elif [[ -f /etc/redhat-release ]]; then
        OS="linux"
        DISTRO="rhel"
        PKG_MANAGER="yum"
    fi
    
    export OS DISTRO PKG_MANAGER
}

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
detect_os

# Print banner
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           HCL DX Composer - Setup Script                     ║"
echo "║              Bharat Petroleum Digital Platform               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "Detected: ${CYAN}${OS}${NC} / ${CYAN}${DISTRO}${NC} / Package Manager: ${CYAN}${PKG_MANAGER}${NC}"

# Get script directory (POSIX compatible)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
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
    DOCKER_VERSION=$(docker --version 2>/dev/null | cut -d ' ' -f3 | cut -d ',' -f1)
    print_success "Docker installed (v${DOCKER_VERSION:-unknown})"
else
    print_error "Docker is not installed. Please install Docker first."
    echo ""
    echo "  Installation instructions:"
    case "$PKG_MANAGER" in
        apt)
            echo "    sudo apt-get update && sudo apt-get install -y docker.io docker-compose"
            echo "    sudo systemctl enable --now docker"
            echo "    sudo usermod -aG docker \$USER"
            ;;
        dnf|yum)
            echo "    sudo $PKG_MANAGER install -y docker docker-compose"
            echo "    sudo systemctl enable --now docker"
            echo "    sudo usermod -aG docker \$USER"
            ;;
        apk)
            echo "    sudo apk add docker docker-compose"
            echo "    sudo rc-update add docker boot"
            echo "    sudo service docker start"
            ;;
        pacman)
            echo "    sudo pacman -S docker docker-compose"
            echo "    sudo systemctl enable --now docker"
            ;;
        brew)
            echo "    brew install --cask docker"
            ;;
        *)
            echo "    Visit: https://docs.docker.com/get-docker/"
            ;;
    esac
    exit 1
fi

# Check Docker Compose (v1 or v2)
COMPOSE_CMD=""
if docker compose version &> /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
    print_success "Docker Compose v2 installed"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
    print_success "Docker Compose v1 installed"
else
    print_error "Docker Compose is not installed."
    case "$PKG_MANAGER" in
        apt)
            echo "    sudo apt-get install -y docker-compose"
            ;;
        dnf|yum)
            echo "    sudo $PKG_MANAGER install -y docker-compose"
            ;;
        *)
            echo "    Visit: https://docs.docker.com/compose/install/"
            ;;
    esac
    exit 1
fi

# Check if Docker is running
if docker info &> /dev/null 2>&1; then
    print_success "Docker daemon is running"
else
    print_error "Docker daemon is not running."
    echo ""
    case "$OS" in
        macos)
            echo "  Please start Docker Desktop"
            ;;
        linux)
            echo "  Try: sudo systemctl start docker"
            echo "  Or:  sudo service docker start"
            ;;
    esac
    exit 1
fi

# Check Node.js (optional, for local development)
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version 2>/dev/null)
    print_success "Node.js installed (${NODE_VERSION:-unknown})"
else
    print_warning "Node.js not found (optional, needed for local development)"
    echo ""
    echo "  To install Node.js:"
    case "$PKG_MANAGER" in
        apt)
            echo "    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
            echo "    sudo apt-get install -y nodejs"
            ;;
        dnf|yum)
            echo "    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -"
            echo "    sudo $PKG_MANAGER install -y nodejs"
            ;;
        apk)
            echo "    sudo apk add nodejs npm"
            ;;
        pacman)
            echo "    sudo pacman -S nodejs npm"
            ;;
        brew)
            echo "    brew install node"
            ;;
    esac
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
    
    # Cross-platform random secret generation
    generate_secret() {
        local length=${1:-32}
        if command -v openssl &> /dev/null; then
            openssl rand -base64 "$length" 2>/dev/null | tr -d '\n' | head -c "$length"
        elif [ -r /dev/urandom ]; then
            tr -dc 'a-zA-Z0-9' < /dev/urandom 2>/dev/null | head -c "$length"
        elif command -v python3 &> /dev/null; then
            python3 -c "import secrets; print(secrets.token_urlsafe($length)[:$length])"
        elif command -v python &> /dev/null; then
            python -c "import os, base64; print(base64.b64encode(os.urandom($length)).decode()[:$length])"
        else
            # Fallback: use date and process info (less secure, but works everywhere)
            echo "$(date +%s%N)$$" | sha256sum 2>/dev/null | head -c "$length" || \
            echo "$(date +%s)$$RANDOM" | md5sum 2>/dev/null | head -c "$length" || \
            echo "change_this_secret_$(date +%s)"
        fi
    }
    
    # Generate random secrets
    JWT_SECRET=$(generate_secret 32)
    SESSION_SECRET=$(generate_secret 32)
    DB_PASSWORD=$(generate_secret 16)

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
