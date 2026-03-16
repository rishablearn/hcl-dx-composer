#!/usr/bin/env bash

#===============================================================================
# HCL DX Composer - Interactive Setup Script
# 
# DESCRIPTION:
#   This script guides you through the initial setup of HCL DX Composer.
#   It checks prerequisites, configures environment variables, and prepares
#   the application for deployment.
#
# USAGE:
#   ./scripts/setup.sh [OPTIONS]
#
# OPTIONS:
#   --skip-prompts    Skip interactive prompts (use defaults)
#   --help            Show this help message
#
# PREREQUISITES:
#   - Docker (required) - Container runtime
#   - Docker Compose (required) - Container orchestration
#   - Node.js 18+ (optional) - For local development only
#
# CONFIGURATION:
#   The script creates a .env file with the following sections:
#   - Database: PostgreSQL connection settings
#   - Backend: API server configuration and secrets
#   - Frontend: React app settings
#   - LDAP: Active Directory authentication
#   - HCL DX: Integration with HCL Digital Experience
#   - AI: Optional AI image generation APIs
#
# COMPATIBLE WITH:
#   macOS, Ubuntu, Debian, CentOS, RHEL, Fedora, Alpine Linux
#
# AUTHOR: HCL DX Composer Team
# VERSION: 2.0.0
#===============================================================================

set -e

#-------------------------------------------------------------------------------
# Global Variables
#-------------------------------------------------------------------------------
SKIP_PROMPTS=false
INTERACTIVE=true

#-------------------------------------------------------------------------------
# Parse Command Line Arguments
#-------------------------------------------------------------------------------
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-prompts)
                SKIP_PROMPTS=true
                INTERACTIVE=false
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
}

#-------------------------------------------------------------------------------
# Show Help Message
#-------------------------------------------------------------------------------
show_help() {
    echo ""
    echo "HCL DX Composer - Setup Script"
    echo ""
    echo "Usage: ./scripts/setup.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --skip-prompts    Skip interactive prompts and use defaults"
    echo "  --help, -h        Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/setup.sh                  # Interactive setup"
    echo "  ./scripts/setup.sh --skip-prompts   # Quick setup with defaults"
    echo ""
    echo "Documentation: docs/HCL-DX-INTEGRATION.md"
    echo ""
}

#-------------------------------------------------------------------------------
# Prompt user for input with default value
# Usage: prompt_input "Question" "default_value" variable_name
#-------------------------------------------------------------------------------
prompt_input() {
    local question="$1"
    local default="$2"
    local var_name="$3"
    local value=""
    
    if [ "$INTERACTIVE" = true ]; then
        if [ -n "$default" ]; then
            read -p "$question [$default]: " value
            value="${value:-$default}"
        else
            read -p "$question: " value
        fi
    else
        value="$default"
    fi
    
    eval "$var_name=\"$value\""
}

#-------------------------------------------------------------------------------
# Prompt user for yes/no with default
# Usage: prompt_yes_no "Question" "Y" (returns 0 for yes, 1 for no)
#-------------------------------------------------------------------------------
prompt_yes_no() {
    local question="$1"
    local default="${2:-N}"
    
    if [ "$INTERACTIVE" = false ]; then
        [[ "$default" =~ ^[Yy]$ ]] && return 0 || return 1
    fi
    
    local prompt
    if [[ "$default" =~ ^[Yy]$ ]]; then
        prompt="$question [Y/n]: "
    else
        prompt="$question [y/N]: "
    fi
    
    read -p "$prompt" answer
    answer="${answer:-$default}"
    [[ "$answer" =~ ^[Yy]$ ]] && return 0 || return 1
}

#-------------------------------------------------------------------------------
# Prompt for secret input (hidden)
# Usage: prompt_secret "Question" variable_name
#-------------------------------------------------------------------------------
prompt_secret() {
    local question="$1"
    local var_name="$2"
    local value=""
    
    if [ "$INTERACTIVE" = true ]; then
        read -s -p "$question: " value
        echo ""
    fi
    
    eval "$var_name=\"$value\""
}

#-------------------------------------------------------------------------------
# Print section header
#-------------------------------------------------------------------------------
print_section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

#-------------------------------------------------------------------------------
# Print info box
#-------------------------------------------------------------------------------
print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Parse arguments before anything else
parse_args "$@"

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
# Detect if sudo is required for Docker commands
# On Linux, Docker typically requires sudo unless user is in docker group
#-------------------------------------------------------------------------------
detect_docker_sudo() {
    SUDO_CMD=""
    
    # macOS with Docker Desktop doesn't need sudo
    if [[ "$OS" == "macos" ]]; then
        SUDO_CMD=""
    # Check if user can run docker without sudo
    elif docker info &> /dev/null 2>&1; then
        SUDO_CMD=""
    # Check if user is in docker group
    elif groups 2>/dev/null | grep -q docker; then
        SUDO_CMD=""
    # Default to sudo on Linux
    elif [[ "$OS" == "linux" ]]; then
        SUDO_CMD="sudo"
    fi
    
    export SUDO_CMD
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
detect_docker_sudo

# Print banner
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           HCL DX Composer - Setup Script                     ║"
echo "║              Bharat Petroleum Digital Platform               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "Detected: ${CYAN}${OS}${NC} / ${CYAN}${DISTRO}${NC} / Package Manager: ${CYAN}${PKG_MANAGER}${NC}"
if [ -n "$SUDO_CMD" ]; then
    echo -e "Docker commands will use: ${YELLOW}sudo${NC}"
fi

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
# STEP 1: Check Prerequisites
# Verify that required software is installed before proceeding
#-------------------------------------------------------------------------------
print_section "STEP 1: Checking Prerequisites"
print_info "Verifying required software is installed..."
echo ""

# Check Docker
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$($SUDO_CMD docker --version 2>/dev/null | cut -d ' ' -f3 | cut -d ',' -f1)
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
if $SUDO_CMD docker compose version &> /dev/null 2>&1; then
    COMPOSE_CMD="$SUDO_CMD docker compose"
    print_success "Docker Compose v2 installed"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="$SUDO_CMD docker-compose"
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
if $SUDO_CMD docker info &> /dev/null 2>&1; then
    print_success "Docker daemon is running"
else
    print_error "Docker daemon is not running."
    echo ""
    case "$OS" in
        macos)
            echo "  Please start Docker Desktop"
            ;;
        linux)
            echo "  Start Docker with:"
            echo "    sudo systemctl start docker"
            echo "  Or:"
            echo "    sudo service docker start"
            echo ""
            echo "  Enable Docker on boot:"
            echo "    sudo systemctl enable docker"
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
# Create environment file with interactive configuration
#-------------------------------------------------------------------------------
print_section "STEP 2: Environment Configuration"

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
        echo "$(date +%s%N)$$" | sha256sum 2>/dev/null | head -c "$length" || \
        echo "$(date +%s)$$RANDOM" | md5sum 2>/dev/null | head -c "$length" || \
        echo "change_this_secret_$(date +%s)"
    fi
}

if [ -f ".env" ]; then
    print_warning ".env file already exists"
    if prompt_yes_no "Do you want to reconfigure it?" "N"; then
        cp .env ".env.backup.$(date +%Y%m%d_%H%M%S)"
        print_info "Backup saved to .env.backup.*"
        rm .env
    else
        print_success "Keeping existing .env file"
    fi
fi

if [ ! -f ".env" ]; then
    echo ""
    print_info "We'll now configure your environment step by step."
    print_info "Press Enter to accept default values shown in [brackets]."
    echo ""
    
    #---------------------------------------------------------------------------
    # Database Configuration
    #---------------------------------------------------------------------------
    print_step "Database Configuration"
    print_info "PostgreSQL database settings for storing application data."
    echo ""
    
    prompt_input "Database name" "hcl_dx_staging" POSTGRES_DB
    prompt_input "Database user" "hcldx" POSTGRES_USER
    DB_PASSWORD=$(generate_secret 16)
    if [ "$INTERACTIVE" = true ]; then
        echo -e "Database password: ${YELLOW}[auto-generated]${NC}"
        if prompt_yes_no "Generate a secure random password?" "Y"; then
            print_success "Secure password generated"
        else
            prompt_secret "Enter database password" DB_PASSWORD
        fi
    fi
    prompt_input "Database port" "5432" POSTGRES_PORT
    
    #---------------------------------------------------------------------------
    # Backend Configuration
    #---------------------------------------------------------------------------
    print_step "Backend API Configuration"
    print_info "Settings for the Node.js backend server."
    echo ""
    
    prompt_input "Backend port" "3001" BACKEND_PORT
    JWT_SECRET=$(generate_secret 32)
    SESSION_SECRET=$(generate_secret 32)
    print_success "JWT and session secrets auto-generated"
    
    #---------------------------------------------------------------------------
    # Hostname Configuration
    #---------------------------------------------------------------------------
    print_step "Server Hostname Configuration"
    print_info "Enter the hostname or IP address to access this application."
    echo ""
    
    echo -e "${CYAN}Hostname/IP Address:${NC}"
    echo ""
    echo "  Examples:"
    echo -e "    - ${YELLOW}myserver${NC} (short hostname)"
    echo -e "    - ${YELLOW}myserver.local${NC} (with domain)"
    echo -e "    - ${YELLOW}192.168.1.100${NC} (IP address)"
    echo -e "    - ${YELLOW}localhost${NC} (local only)"
    echo ""
    echo "  Tips:"
    echo "    - Use IP address for most reliable access"
    echo "    - Use hostname for SSL certificates"
    echo "    - Run 'hostname' or 'ip addr' to find your values"
    echo ""
    
    # Ask user directly - no auto-detection
    read -p "Enter server hostname or IP [localhost]: " APP_HOSTNAME
    APP_HOSTNAME="${APP_HOSTNAME:-localhost}"
    
    # Clean up - remove spaces and newlines
    APP_HOSTNAME=$(echo "$APP_HOSTNAME" | tr -d '\n\r' | xargs)
    
    # Validate not empty
    if [ -z "$APP_HOSTNAME" ]; then
        APP_HOSTNAME="localhost"
    fi
    
    print_success "Hostname configured: ${APP_HOSTNAME}"
    echo ""
    echo -e "  Access URLs will be:"
    echo -e "    HTTP:  ${BLUE}http://${APP_HOSTNAME}:3000${NC}"
    echo -e "    HTTPS: ${BLUE}https://${APP_HOSTNAME}:443${NC} (if SSL enabled)"
    
    #---------------------------------------------------------------------------
    # Frontend Configuration
    #---------------------------------------------------------------------------
    print_step "Frontend Configuration"
    print_info "Settings for the React frontend application."
    echo ""
    
    prompt_input "Frontend port" "3000" FRONTEND_PORT
    
    # API URL uses relative path - nginx proxies to backend
    VITE_API_BASE_URL="/api"
    print_info "API requests will be proxied through nginx at /api"
    
    #---------------------------------------------------------------------------
    # LDAP Configuration (API Integration)
    #---------------------------------------------------------------------------
    print_step "LDAP Authentication Configuration"
    echo ""
    print_info "All authentication happens via API. Choose your LDAP mode:"
    echo ""
    echo -e "${CYAN}LDAP Integration Options:${NC}"
    echo ""
    echo "  ┌─────────────────────────────────────────────────────────────────────┐"
    echo "  │                     LDAP AUTHENTICATION MODES                        │"
    echo "  ├─────────────────┬───────────────────────────────────────────────────┤"
    echo "  │ LOCAL LDAP      │ Docker OpenLDAP container (included)              │"
    echo "  │                 │ • Standalone user management                      │"
    echo "  │                 │ • Pre-configured users & groups for workflow      │"
    echo "  │                 │ • Best for: Development, Testing, Demos           │"
    echo "  ├─────────────────┼───────────────────────────────────────────────────┤"
    echo "  │ COMMON LDAP     │ Shared LDAP with HCL DX (Active Directory/LDAP)   │"
    echo "  │                 │ • Same users as HCL DX Portal                     │"
    echo "  │                 │ • Enterprise SSO integration                      │"
    echo "  │                 │ • Best for: Production, Enterprise                │"
    echo "  └─────────────────┴───────────────────────────────────────────────────┘"
    echo ""
    
    LDAP_MODE="local"
    CONFIGURE_LDAP=false
    
    if [ "$INTERACTIVE" = true ]; then
        if prompt_yes_no "Configure LDAP authentication?" "Y"; then
            CONFIGURE_LDAP=true
        fi
    fi
    
    if [ "$CONFIGURE_LDAP" = true ]; then
        echo ""
        echo -e "${YELLOW}Select LDAP Mode:${NC}"
        echo ""
        echo "  1) Local OpenLDAP (Docker) - Recommended for development"
        echo "     • Auto-configured with workflow users & groups"
        echo "     • Pre-created: admin, author, reviewer, publisher users"
        echo "     • Groups: Admins, Authors, Reviewers, Publishers"
        echo "     • No external dependencies"
        echo ""
        echo "  2) Common LDAP (HCL DX / Active Directory)"
        echo "     • Connect to existing enterprise LDAP"
        echo "     • Same user directory as HCL DX"
        echo "     • Requires LDAP server details"
        echo ""
        read -p "Enter choice [1]: " ldap_choice
        ldap_choice="${ldap_choice:-1}"
        
        case "$ldap_choice" in
            1)
                LDAP_MODE="local"
                echo ""
                print_info "Local OpenLDAP selected"
                print_success "Docker OpenLDAP will be deployed automatically with your application!"
                echo ""
                echo -e "${CYAN}┌─────────────────────────────────────────────────────────────┐${NC}"
                echo -e "${CYAN}│            LOCAL LDAP - AUTO-DEPLOYMENT                     │${NC}"
                echo -e "${CYAN}├─────────────────────────────────────────────────────────────┤${NC}"
                echo -e "${CYAN}│ When you run: ./scripts/deploy.sh --build                   │${NC}"
                echo -e "${CYAN}│                                                             │${NC}"
                echo -e "${CYAN}│ The following will be deployed automatically:               │${NC}"
                echo -e "${CYAN}│   • OpenLDAP container (hcl-dx-openldap)                    │${NC}"
                echo -e "${CYAN}│   • Pre-configured users & groups                           │${NC}"
                echo -e "${CYAN}│   • All services connected to Local LDAP                    │${NC}"
                echo -e "${CYAN}└─────────────────────────────────────────────────────────────┘${NC}"
                echo ""
                print_info "Pre-configured Users (password: 'password'):"
                echo "  • admin     - Full system access (Admins group)"
                echo "  • author    - Content creation (Authors group)"
                echo "  • author2   - Secondary author (Authors group)"
                echo "  • reviewer  - Content review & approval (Reviewers group)"
                echo "  • reviewer2 - Secondary reviewer (Reviewers group)"
                echo "  • publisher - Publish to HCL DX (Publishers group)"
                echo ""
                print_info "Management scripts available after deployment:"
                echo "  • ./ldap/scripts/manage-ldap.sh list-users"
                echo "  • ./ldap/scripts/manage-ldap.sh add-user <user> <pass> <first> <last>"
                echo "  • ./ldap/scripts/manage-ldap.sh add-to-group <user> <group>"
                echo ""
                
                # Local LDAP settings (Docker OpenLDAP)
                LDAP_URL="ldap://openldap:389"
                LDAP_BASE_DN="dc=hcldx,dc=local"
                LDAP_BIND_DN="cn=admin,dc=hcldx,dc=local"
                LDAP_BIND_PASSWORD="admin_password"
                LDAP_USER_SEARCH_BASE="ou=Users,dc=hcldx,dc=local"
                LDAP_GROUP_SEARCH_BASE="ou=Groups,dc=hcldx,dc=local"
                LDAP_ADMIN_PASSWORD="admin_password"
                LDAP_CONFIG_PASSWORD="config_password"
                LDAP_ORGANISATION="HCL DX Composer"
                LDAP_DOMAIN="hcldx.local"
                ;;
            2)
                LDAP_MODE="common"
                echo ""
                print_info "Common LDAP (HCL DX / Active Directory) selected"
                echo ""
                prompt_input "LDAP server URL" "ldap://your-ldap-server:389" LDAP_URL
                prompt_input "Base DN" "DC=company,DC=com" LDAP_BASE_DN
                prompt_input "Bind DN (service account)" "CN=ServiceAccount,OU=ServiceAccounts,DC=company,DC=com" LDAP_BIND_DN
                prompt_secret "Bind password" LDAP_BIND_PASSWORD
                LDAP_BIND_PASSWORD="${LDAP_BIND_PASSWORD:-your_ldap_password}"
                prompt_input "User search base" "OU=Users,DC=company,DC=com" LDAP_USER_SEARCH_BASE
                prompt_input "Group search base" "OU=Groups,DC=company,DC=com" LDAP_GROUP_SEARCH_BASE
                
                # Not used for common LDAP
                LDAP_ADMIN_PASSWORD=""
                LDAP_CONFIG_PASSWORD=""
                LDAP_ORGANISATION=""
                LDAP_DOMAIN=""
                ;;
            *)
                LDAP_MODE="local"
                print_warning "Invalid choice, defaulting to Local OpenLDAP"
                LDAP_URL="ldap://openldap:389"
                LDAP_BASE_DN="dc=hcldx,dc=local"
                LDAP_BIND_DN="cn=admin,dc=hcldx,dc=local"
                LDAP_BIND_PASSWORD="admin_password"
                LDAP_USER_SEARCH_BASE="ou=Users,dc=hcldx,dc=local"
                LDAP_GROUP_SEARCH_BASE="ou=Groups,dc=hcldx,dc=local"
                LDAP_ADMIN_PASSWORD="admin_password"
                LDAP_CONFIG_PASSWORD="config_password"
                LDAP_ORGANISATION="HCL DX Composer"
                LDAP_DOMAIN="hcldx.local"
                ;;
        esac
        
        print_success "LDAP mode configured: ${LDAP_MODE}"
    else
        # Default to local LDAP
        LDAP_MODE="local"
        LDAP_URL="ldap://openldap:389"
        LDAP_BASE_DN="dc=hcldx,dc=local"
        LDAP_BIND_DN="cn=admin,dc=hcldx,dc=local"
        LDAP_BIND_PASSWORD="admin_password"
        LDAP_USER_SEARCH_BASE="ou=Users,dc=hcldx,dc=local"
        LDAP_GROUP_SEARCH_BASE="ou=Groups,dc=hcldx,dc=local"
        LDAP_ADMIN_PASSWORD="admin_password"
        LDAP_CONFIG_PASSWORD="config_password"
        LDAP_ORGANISATION="HCL DX Composer"
        LDAP_DOMAIN="hcldx.local"
        print_info "Using Local OpenLDAP (default). Run setup again to change."
    fi
    
    #---------------------------------------------------------------------------
    # HCL DX API Configuration (Pure API Integration)
    #---------------------------------------------------------------------------
    print_step "HCL Digital Experience API Configuration"
    echo ""
    print_info "This application integrates with HCL DX using REST APIs only."
    print_info "No direct server access is required - just API credentials."
    echo ""
    echo -e "${CYAN}You will need from your HCL DX administrator:${NC}"
    echo "  • API Key or credentials for authentication"
    echo "  • HCL DX server hostname"
    echo "  • WCM Library name for content storage"
    echo "  • Confirmation that CORS is enabled for your domain"
    echo ""
    
    CONFIGURE_DX=false
    if [ "$INTERACTIVE" = true ]; then
        if prompt_yes_no "Configure HCL DX API integration now?" "Y"; then
            CONFIGURE_DX=true
        fi
    fi
    
    if [ "$CONFIGURE_DX" = true ]; then
        echo ""
        echo -e "${YELLOW}── WCM (Web Content Manager) API ──${NC}"
        print_info "Used for creating and publishing content"
        echo ""
        prompt_input "HCL DX hostname (e.g., dx.company.com)" "your-dx-server.domain.com" HCL_DX_HOST
        prompt_input "HCL DX port" "443" HCL_DX_PORT
        prompt_input "Protocol (http/https)" "https" HCL_DX_PROTOCOL
        prompt_input "WCM Library name" "Web Content" HCL_DX_WCM_LIBRARY
        
        echo ""
        echo -e "${YELLOW}── Service Account Authentication ──${NC}"
        print_info "HCL DX uses Basic Authentication (username/password)"
        print_info "Request a service account from your HCL DX administrator"
        echo ""
        prompt_input "HCL DX Username (service account)" "wcmservice" HCL_DX_USERNAME
        prompt_secret "HCL DX Password" HCL_DX_PASSWORD
        HCL_DX_PASSWORD="${HCL_DX_PASSWORD:-your_dx_password}"
        
        echo ""
        echo -e "${YELLOW}── DAM (Digital Asset Management) API ──${NC}"
        print_info "Used for uploading and managing images/files"
        echo ""
        
        # Auto-generate API URLs from hostname
        HCL_DX_WCM_BASE_URL="${HCL_DX_PROTOCOL}://${HCL_DX_HOST}/wps/mycontenthandler/wcmrest"
        HCL_DX_DAM_BASE_URL="${HCL_DX_PROTOCOL}://${HCL_DX_HOST}/dx/api/dam/v1"
        
        echo -e "  WCM API URL: ${GREEN}${HCL_DX_WCM_BASE_URL}${NC}"
        echo -e "  DAM API URL: ${GREEN}${HCL_DX_DAM_BASE_URL}${NC}"
        echo ""
        
        if prompt_yes_no "Use custom API URLs instead?" "N"; then
            prompt_input "WCM REST API URL" "$HCL_DX_WCM_BASE_URL" HCL_DX_WCM_BASE_URL
            prompt_input "DAM API URL" "$HCL_DX_DAM_BASE_URL" HCL_DX_DAM_BASE_URL
        fi
        
        print_success "HCL DX API configuration complete"
    else
        HCL_DX_HOST="your-dx-server.domain.com"
        HCL_DX_PORT="443"
        HCL_DX_PROTOCOL="https"
        HCL_DX_USERNAME="wcmservice"
        HCL_DX_PASSWORD="your_dx_password"
        HCL_DX_DAM_BASE_URL="https://your-dx-server/dx/api/dam/v1"
        HCL_DX_WCM_BASE_URL="https://your-dx-server/wps/mycontenthandler/wcmrest"
        HCL_DX_WCM_LIBRARY="Web Content"
        print_warning "HCL DX API not configured. Update .env file later."
        print_info "See docs/HCL-DX-INTEGRATION.md for API configuration guide."
    fi
    
    #---------------------------------------------------------------------------
    # AI Image Generation Configuration (Optional)
    #---------------------------------------------------------------------------
    print_step "AI Image Generation (Optional)"
    echo ""
    print_info "Generate images using AI and integrate them into the DAM workflow."
    echo ""
    echo -e "${CYAN}Available AI Providers:${NC}"
    echo ""
    echo "  ┌─────────────────┬──────────────────────┬─────────────┬──────────────────┐"
    echo "  │ Provider        │ Model                │ Free Tier   │ Best For         │"
    echo "  ├─────────────────┼──────────────────────┼─────────────┼──────────────────┤"
    echo "  │ Pollinations    │ FLUX, Turbo          │ ✓ Unlimited │ No signup needed │"
    echo "  │ Cloudflare      │ FLUX.1, SDXL         │ ✓ 10k/day   │ Edge, reliable   │"
    echo "  │ Google Gemini   │ Gemini Flash Image   │ ✓ 500/day   │ General, Fast    │"
    echo "  │ Hugging Face    │ FLUX.1, Stable Diff  │ ✓ Limited   │ Open-source      │"
    echo "  │ OpenAI          │ DALL-E 3             │ ✗ Paid      │ Photorealistic   │"
    echo "  │ Stability AI    │ SDXL, SD3            │ ✗ Paid      │ Artistic         │"
    echo "  └─────────────────┴──────────────────────┴─────────────┴──────────────────┘"
    echo ""
    
    CONFIGURE_AI=false
    if [ "$INTERACTIVE" = true ]; then
        if prompt_yes_no "Configure AI image generation?" "N"; then
            CONFIGURE_AI=true
        fi
    fi
    
    # Initialize AI provider variables
    OPENAI_API_KEY=""
    STABILITY_API_KEY=""
    GOOGLE_AI_API_KEY=""
    HUGGINGFACE_API_KEY=""
    POLLINATIONS_API_KEY=""
    CLOUDFLARE_ACCOUNT_ID=""
    CLOUDFLARE_API_TOKEN=""
    CLOUDFLARE_AI_MODEL="@cf/black-forest-labs/flux-1-schnell"
    AI_IMAGE_PROVIDER="pollinations"
    HUGGINGFACE_MODEL="black-forest-labs/FLUX.1-schnell"
    
    if [ "$CONFIGURE_AI" = true ]; then
        echo ""
        echo -e "${YELLOW}Select AI Provider:${NC}"
        echo ""
        echo "  1) Pollinations AI (FREE) - No signup required!"
        echo "     • Unlimited images (fair use)"
        echo "     • NO API KEY NEEDED"
        echo "     • Models: FLUX, Turbo"
        echo "     • Website: https://pollinations.ai"
        echo ""
        echo "  2) Cloudflare Workers AI (FREE) - Edge deployment"
        echo "     • 10,000 neurons/day (~30-100 images)"
        echo "     • Models: FLUX.1 schnell, SDXL"
        echo "     • Get credentials: https://dash.cloudflare.com"
        echo ""
        echo "  3) Google Gemini (FREE) - High quality"
        echo "     • 500 free images/day"
        echo "     • Model: gemini-2.5-flash-image"
        echo "     • Get API key: https://aistudio.google.com/apikey"
        echo ""
        echo "  4) Hugging Face (FREE) - Open-source models"
        echo "     • Limited free inference API requests"
        echo "     • Models: FLUX.1, Stable Diffusion XL"
        echo "     • Get API key: https://huggingface.co/settings/tokens"
        echo ""
        echo "  5) OpenAI DALL-E (PAID) - Premium quality"
        echo "     • Pay-per-image pricing"
        echo "     • Model: DALL-E 3"
        echo "     • Get API key: https://platform.openai.com/api-keys"
        echo ""
        echo "  6) Stability AI (PAID) - Fine artistic control"
        echo "     • Pay-per-image pricing"
        echo "     • Models: SDXL, Stable Diffusion 3"
        echo "     • Get API key: https://platform.stability.ai/account/keys"
        echo ""
        read -p "Enter choice [1]: " ai_choice
        ai_choice="${ai_choice:-1}"
        
        case "$ai_choice" in
            1)
                AI_IMAGE_PROVIDER="pollinations"
                echo ""
                print_info "Pollinations AI selected (FREE - No API key needed!)"
                print_success "No configuration required - ready to use!"
                ;;
            2)
                AI_IMAGE_PROVIDER="cloudflare"
                echo ""
                print_info "Cloudflare Workers AI selected (FREE tier available)"
                prompt_input "Cloudflare Account ID" "" CLOUDFLARE_ACCOUNT_ID
                prompt_secret "Cloudflare API Token" CLOUDFLARE_API_TOKEN
                prompt_input "Cloudflare AI Model" "@cf/black-forest-labs/flux-1-schnell" CLOUDFLARE_AI_MODEL
                ;;
            3)
                AI_IMAGE_PROVIDER="gemini"
                echo ""
                print_info "Google Gemini selected (FREE tier available)"
                prompt_secret "Enter Google AI API key (from AI Studio)" GOOGLE_AI_API_KEY
                ;;
            4)
                AI_IMAGE_PROVIDER="huggingface"
                echo ""
                print_info "Hugging Face selected (FREE tier available)"
                prompt_secret "Enter Hugging Face API token" HUGGINGFACE_API_KEY
                prompt_input "Hugging Face model" "black-forest-labs/FLUX.1-schnell" HUGGINGFACE_MODEL
                ;;
            5)
                AI_IMAGE_PROVIDER="openai"
                echo ""
                print_info "OpenAI DALL-E selected (Paid)"
                prompt_secret "Enter OpenAI API key" OPENAI_API_KEY
                ;;
            6)
                AI_IMAGE_PROVIDER="stability"
                echo ""
                print_info "Stability AI selected (Paid)"
                prompt_secret "Enter Stability AI API key" STABILITY_API_KEY
                ;;
            *)
                AI_IMAGE_PROVIDER="pollinations"
                print_warning "Invalid choice, defaulting to Pollinations AI (free, no signup)"
                ;;
        esac
        
        print_success "AI provider configured: ${AI_IMAGE_PROVIDER}"
    fi
    
    #---------------------------------------------------------------------------
    # SSL/HTTPS Configuration
    #---------------------------------------------------------------------------
    print_section "SSL/HTTPS Configuration"
    
    SSL_ENABLED="false"
    SSL_TYPE="none"
    SSL_DOMAIN="${APP_HOSTNAME}"
    
    echo ""
    echo -e "${CYAN}Do you want to enable HTTPS/SSL?${NC}"
    echo ""
    echo -e "  Hostname: ${YELLOW}${APP_HOSTNAME}${NC}"
    echo ""
    echo "  1) No SSL (HTTP only) - Development/Testing"
    echo "  2) Self-signed certificate - Development/Internal use"
    echo "  3) Let's Encrypt - Production (requires public domain)"
    echo "  4) Import existing certificate - Enterprise/Custom CA"
    echo ""
    read -p "Enter choice [1]: " ssl_choice
    ssl_choice="${ssl_choice:-1}"
    
    case "$ssl_choice" in
        1)
            SSL_ENABLED="false"
            SSL_TYPE="none"
            print_info "SSL disabled - using HTTP only"
            ;;
        2)
            SSL_ENABLED="true"
            SSL_TYPE="self-signed"
            echo ""
            SSL_DOMAIN="${APP_HOSTNAME}"
            print_info "Generating certificate for: ${SSL_DOMAIN}"
            prompt_input "Certificate validity (days)" "365" SSL_VALIDITY_DAYS
            
            print_info "Generating self-signed certificate..."
            
            # Create SSL directories
            mkdir -p ssl/certs ssl/private
            chmod 700 ssl/private
            
            # Create OpenSSL config
            cat > ssl/openssl.cnf << SSLEOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
C = US
ST = State
L = City
O = HCL DX Composer
OU = Development
CN = ${SSL_DOMAIN}

[v3_req]
subjectAltName = @alt_names
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[alt_names]
DNS.1 = ${SSL_DOMAIN}
DNS.2 = localhost
DNS.3 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
SSLEOF
            
            # Generate certificate
            openssl genrsa -out ssl/private/server.key 2048 2>/dev/null
            openssl req -new -x509 \
                -key ssl/private/server.key \
                -out ssl/certs/server.crt \
                -days ${SSL_VALIDITY_DAYS:-365} \
                -config ssl/openssl.cnf \
                -extensions v3_req 2>/dev/null
            
            chmod 644 ssl/certs/server.crt
            chmod 600 ssl/private/server.key
            
            print_success "Self-signed certificate generated for ${SSL_DOMAIN}"
            print_warning "Browsers will show security warning for self-signed certificates"
            ;;
        3)
            SSL_ENABLED="true"
            SSL_TYPE="letsencrypt"
            echo ""
            prompt_input "Domain name (must be publicly accessible)" "" SSL_DOMAIN
            prompt_input "Email for Let's Encrypt notifications" "" SSL_EMAIL
            
            if [ -z "$SSL_DOMAIN" ] || [ -z "$SSL_EMAIL" ]; then
                print_error "Domain and email are required for Let's Encrypt"
                SSL_ENABLED="false"
                SSL_TYPE="none"
            else
                print_info "Let's Encrypt will be configured during deployment"
                print_warning "Ensure port 80 is accessible from the internet"
                print_warning "DNS must point to this server before deployment"
            fi
            ;;
        4)
            SSL_ENABLED="true"
            SSL_TYPE="imported"
            echo ""
            print_info "Import your existing SSL certificate"
            prompt_input "Path to certificate file (.crt/.pem)" "" SSL_CERT_PATH
            prompt_input "Path to private key file (.key)" "" SSL_KEY_PATH
            prompt_input "Path to CA chain file (optional)" "" SSL_CHAIN_PATH
            
            if [ -z "$SSL_CERT_PATH" ] || [ -z "$SSL_KEY_PATH" ]; then
                print_error "Certificate and key paths are required"
                SSL_ENABLED="false"
                SSL_TYPE="none"
            elif [ ! -f "$SSL_CERT_PATH" ]; then
                print_error "Certificate file not found: $SSL_CERT_PATH"
                SSL_ENABLED="false"
                SSL_TYPE="none"
            elif [ ! -f "$SSL_KEY_PATH" ]; then
                print_error "Key file not found: $SSL_KEY_PATH"
                SSL_ENABLED="false"
                SSL_TYPE="none"
            else
                # Create SSL directories
                mkdir -p ssl/certs ssl/private
                chmod 700 ssl/private
                
                # Copy certificate
                cp "$SSL_CERT_PATH" ssl/certs/server.crt
                cp "$SSL_KEY_PATH" ssl/private/server.key
                
                # Append chain if provided
                if [ -n "$SSL_CHAIN_PATH" ] && [ -f "$SSL_CHAIN_PATH" ]; then
                    cat "$SSL_CHAIN_PATH" >> ssl/certs/server.crt
                    print_success "Certificate chain appended"
                fi
                
                chmod 644 ssl/certs/server.crt
                chmod 600 ssl/private/server.key
                
                # Verify certificate and key match
                cert_mod=$(openssl x509 -noout -modulus -in ssl/certs/server.crt 2>/dev/null | openssl md5)
                key_mod=$(openssl rsa -noout -modulus -in ssl/private/server.key 2>/dev/null | openssl md5)
                
                if [ "$cert_mod" != "$key_mod" ]; then
                    print_error "Certificate and private key do not match!"
                    rm -f ssl/certs/server.crt ssl/private/server.key
                    SSL_ENABLED="false"
                    SSL_TYPE="none"
                else
                    # Extract domain from certificate
                    SSL_DOMAIN=$(openssl x509 -noout -subject -in ssl/certs/server.crt 2>/dev/null | sed -n 's/.*CN=\([^,\/]*\).*/\1/p')
                    print_success "Certificate imported successfully for ${SSL_DOMAIN:-unknown domain}"
                fi
            fi
            ;;
        *)
            SSL_ENABLED="false"
            SSL_TYPE="none"
            print_info "SSL disabled - using HTTP only"
            ;;
    esac
    
    # Set SSL port
    if [ "$SSL_ENABLED" = "true" ]; then
        prompt_input "HTTPS port" "443" FRONTEND_SSL_PORT
        print_success "SSL configured: ${SSL_TYPE} (https://${SSL_DOMAIN}:${FRONTEND_SSL_PORT})"
    fi
    
    #---------------------------------------------------------------------------
    # Write configuration file
    #---------------------------------------------------------------------------
    print_step "Writing configuration..."
    
    cat > .env << EOF
#===============================================================================
# HCL DX Composer - Environment Configuration
# 
# Generated on: $(date)
# Generated by: setup.sh v2.0.0
#
# IMPORTANT: This file contains sensitive information.
# - Do NOT commit this file to version control
# - Keep this file secure with restricted permissions
# - Backup this file before making changes
#===============================================================================

#-------------------------------------------------------------------------------
# Environment Mode
# Options: development, production, staging
# - production: Optimized builds, minified assets, error logging
# - development: Hot reload, detailed errors, debug logging
#-------------------------------------------------------------------------------
NODE_ENV=production

#===============================================================================
# DATABASE CONFIGURATION
# 
# PostgreSQL database for storing:
# - User accounts and sessions
# - Content metadata and workflows
# - Application settings and audit logs
#===============================================================================
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_PORT=${POSTGRES_PORT}

#===============================================================================
# BACKEND API CONFIGURATION
# 
# Node.js Express server settings
# JWT_SECRET: Used for signing authentication tokens (keep secret!)
# SESSION_SECRET: Used for encrypting session data (keep secret!)
#===============================================================================
BACKEND_PORT=${BACKEND_PORT}
JWT_SECRET=${JWT_SECRET}
SESSION_SECRET=${SESSION_SECRET}

#===============================================================================
# SERVER HOSTNAME
# 
# The hostname used to access this application
# Used for: SSL certificates, CORS, accessing from network
#===============================================================================
APP_HOSTNAME=${APP_HOSTNAME}

#===============================================================================
# FRONTEND CONFIGURATION
# 
# React application settings
# VITE_API_BASE_URL: Uses /api - nginx proxies to backend
#===============================================================================
FRONTEND_PORT=${FRONTEND_PORT}
VITE_API_BASE_URL=${VITE_API_BASE_URL}

#===============================================================================
# LDAP AUTHENTICATION CONFIGURATION (API Integration)
# 
# All authentication happens through the API. Choose your LDAP mode:
#
# LDAP_MODE Options:
# ─────────────────────────────────────────────────────────────────────────────
# 'local'  - Docker OpenLDAP container (included, recommended for dev/test)
#            • Pre-configured users: admin, author, reviewer, publisher
#            • Pre-configured groups: Admins, Authors, Reviewers, Publishers
#            • Password for all users: 'password'
#
# 'common' - Shared LDAP with HCL DX (Active Directory / Enterprise LDAP)
#            • Same users as HCL DX Portal
#            • Enterprise SSO integration
#            • Configure your LDAP server details below
#===============================================================================
LDAP_MODE=${LDAP_MODE}
LDAP_URL=${LDAP_URL}
LDAP_BASE_DN=${LDAP_BASE_DN}
LDAP_BIND_DN=${LDAP_BIND_DN}
LDAP_BIND_PASSWORD=${LDAP_BIND_PASSWORD}
LDAP_USER_SEARCH_BASE=${LDAP_USER_SEARCH_BASE}
LDAP_GROUP_SEARCH_BASE=${LDAP_GROUP_SEARCH_BASE}

# Local OpenLDAP Docker Settings (only used when LDAP_MODE=local)
LDAP_ADMIN_PASSWORD=${LDAP_ADMIN_PASSWORD}
LDAP_CONFIG_PASSWORD=${LDAP_CONFIG_PASSWORD}
LDAP_ORGANISATION=${LDAP_ORGANISATION}
LDAP_DOMAIN=${LDAP_DOMAIN}

#===============================================================================
# HCL DIGITAL EXPERIENCE API CONFIGURATION
# 
# Pure API integration with HCL DX for:
# - Web Content Management (WCM) via REST API
# - Digital Asset Management (DAM) via REST API
# - Content publishing and syndication
#
# Authentication: Basic Auth (username/password)
# Request service account credentials from your HCL DX administrator
#===============================================================================
HCL_DX_HOST=${HCL_DX_HOST}
HCL_DX_PORT=${HCL_DX_PORT}
HCL_DX_PROTOCOL=${HCL_DX_PROTOCOL}

# Service Account for API Authentication (Basic Auth)
HCL_DX_USERNAME=${HCL_DX_USERNAME}
HCL_DX_PASSWORD=${HCL_DX_PASSWORD}

# API Endpoints
HCL_DX_DAM_BASE_URL=${HCL_DX_DAM_BASE_URL}
HCL_DX_WCM_BASE_URL=${HCL_DX_WCM_BASE_URL}
HCL_DX_WCM_LIBRARY=${HCL_DX_WCM_LIBRARY}

#===============================================================================
# LTPA2 SSO CONFIGURATION (Optional)
# 
# IBM/HCL Lightweight Third-Party Authentication
# Enables seamless SSO between this app and HCL DX/WebSphere
# Contact your WebSphere administrator for these values
#===============================================================================
LTPA2_SECRET_KEY=
LTPA2_REALM=

#===============================================================================
# AI IMAGE GENERATION (Optional)
# 
# Enable AI-powered image generation for content creation
# Multiple providers supported - choose based on your needs:
#
# FREE TIER OPTIONS (NO COST):
# ─────────────────────────────────────────────────────────────────────────────
# Pollinations AI (EASIEST - No signup required!)
#   • Unlimited images (fair use)
#   • NO API KEY NEEDED
#   • Models: FLUX, Turbo
#   • Website: https://pollinations.ai
#
# Cloudflare Workers AI (Edge deployment)
#   • 10,000 neurons/day (~30-100 images)
#   • Models: FLUX.1 schnell, SDXL
#   • Get credentials: https://dash.cloudflare.com
#
# Google Gemini
#   • 500 free images/day
#   • Models: gemini-2.5-flash-image, gemini-3.1-flash-image-preview
#   • Get key: https://aistudio.google.com/apikey
#
# Hugging Face
#   • Limited free API requests
#   • Models: FLUX.1-schnell, FLUX.1-dev, stable-diffusion-xl
#   • Get token: https://huggingface.co/settings/tokens
#
# PAID OPTIONS:
# ─────────────────────────────────────────────────────────────────────────────
# OpenAI (DALL-E 3)
#   • \$0.040-0.080 per image
#   • Get key: https://platform.openai.com/api-keys
#
# Stability AI (SDXL, SD3)
#   • Pay-per-credit pricing
#   • Get key: https://platform.stability.ai/account/keys
#
# AI_IMAGE_PROVIDER: 'pollinations', 'cloudflare', 'gemini', 'huggingface', 'openai', or 'stability'
#===============================================================================
AI_IMAGE_PROVIDER=${AI_IMAGE_PROVIDER}

# Pollinations AI (FREE - No API key required!)
# Just works out of the box - no configuration needed
# Optional API key for premium features: https://enter.pollinations.ai
POLLINATIONS_API_KEY=${POLLINATIONS_API_KEY}

# Cloudflare Workers AI (FREE - 10k neurons/day)
# Get credentials from: https://dash.cloudflare.com
CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID}
CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN}
CLOUDFLARE_AI_MODEL=${CLOUDFLARE_AI_MODEL:-@cf/black-forest-labs/flux-1-schnell}

# Google Gemini (FREE)
GOOGLE_AI_API_KEY=${GOOGLE_AI_API_KEY}
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image

# Hugging Face (FREE)
HUGGINGFACE_API_KEY=${HUGGINGFACE_API_KEY}
HUGGINGFACE_MODEL=${HUGGINGFACE_MODEL:-black-forest-labs/FLUX.1-schnell}

# OpenAI DALL-E (Paid)
OPENAI_API_KEY=${OPENAI_API_KEY}

# Stability AI (Paid)
STABILITY_API_KEY=${STABILITY_API_KEY}

#===============================================================================
# UPLOAD CONFIGURATION
# 
# MAX_UPLOAD_SIZE: Maximum file upload size in bytes
# Default: 52428800 (50 MB)
#===============================================================================
MAX_UPLOAD_SIZE=52428800

#===============================================================================
# SSL/TLS CONFIGURATION
# 
# SSL_ENABLED: Enable HTTPS (true/false)
# SSL_TYPE: Certificate type (none, self-signed, letsencrypt, imported)
# SSL_DOMAIN: Domain name for the certificate
#
# To reconfigure SSL later, run:
#   ./scripts/ssl-setup.sh self-signed localhost
#   ./scripts/ssl-setup.sh letsencrypt yourdomain.com admin@yourdomain.com
#   ./scripts/ssl-setup.sh import /path/to/cert.pem /path/to/key.pem
#===============================================================================
SSL_ENABLED=${SSL_ENABLED}
SSL_TYPE=${SSL_TYPE}
SSL_DOMAIN=${SSL_DOMAIN}
FRONTEND_SSL_PORT=${FRONTEND_SSL_PORT:-443}
SSL_EMAIL=${SSL_EMAIL:-}
EOF

    print_success ".env file created successfully!"
fi

#-------------------------------------------------------------------------------
# STEP 3: Create Required Directories
#-------------------------------------------------------------------------------
print_section "STEP 3: Creating Directories"

mkdir -p uploads/ai-generated
mkdir -p uploads/thumbnails
mkdir -p logs
mkdir -p backups
mkdir -p ssl/certs
mkdir -p ssl/private

# Create .gitkeep files to preserve empty directories in git
touch uploads/.gitkeep
touch uploads/ai-generated/.gitkeep
touch uploads/thumbnails/.gitkeep
touch logs/.gitkeep
touch backups/.gitkeep
touch ssl/.gitkeep

# Secure SSL private directory
chmod 700 ssl/private

print_success "Created: uploads/, uploads/ai-generated/, uploads/thumbnails/"
print_success "Created: logs/, backups/, ssl/"

#-------------------------------------------------------------------------------
# STEP 4: Set Permissions
#-------------------------------------------------------------------------------
print_section "STEP 4: Setting Permissions"

# Make scripts executable
chmod +x scripts/*.sh 2>/dev/null || true
print_success "Scripts marked as executable"

# Secure the .env file (readable only by owner)
chmod 600 .env
print_success ".env file secured (chmod 600)"

#===============================================================================
# SETUP COMPLETE - Summary and Next Steps
#===============================================================================
echo ""
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    ✓ Setup Complete!                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  Configuration Summary${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
APP_HOSTNAME_CHECK=$(grep "^APP_HOSTNAME=" .env 2>/dev/null | cut -d'=' -f2)
echo -e "  Hostname:     ${GREEN}${APP_HOSTNAME_CHECK:-localhost}${NC}"
echo -e "  Database:     ${GREEN}PostgreSQL${NC} on port ${YELLOW}${POSTGRES_PORT:-5432}${NC}"
echo -e "  Backend API:  ${GREEN}Node.js${NC} on port ${YELLOW}${BACKEND_PORT:-3001}${NC}"
echo -e "  Frontend:     ${GREEN}React${NC} on port ${YELLOW}${FRONTEND_PORT:-3000}${NC}"
echo ""

# Check what needs configuration
NEEDS_CONFIG=false
LDAP_MODE_CHECK=$(grep "^LDAP_MODE=" .env 2>/dev/null | cut -d'=' -f2)
if [ "$LDAP_MODE_CHECK" = "local" ]; then
    echo -e "  LDAP:         ${GREEN}✓ Local OpenLDAP (Docker)${NC}"
elif [ "$LDAP_MODE_CHECK" = "common" ]; then
    if grep -q "your-ldap-server" .env 2>/dev/null; then
        echo -e "  LDAP:         ${YELLOW}⚠ Common LDAP (not configured)${NC}"
        NEEDS_CONFIG=true
    else
        echo -e "  LDAP:         ${GREEN}✓ Common LDAP (Enterprise)${NC}"
    fi
else
    echo -e "  LDAP:         ${GREEN}✓ Local OpenLDAP (Docker)${NC}"
fi

if grep -q "your-dx-server" .env 2>/dev/null; then
    echo -e "  HCL DX:       ${YELLOW}⚠ Not configured${NC}"
    NEEDS_CONFIG=true
else
    echo -e "  HCL DX:       ${GREEN}✓ Configured${NC}"
fi

if grep -q "OPENAI_API_KEY=$" .env 2>/dev/null && grep -q "STABILITY_API_KEY=$" .env 2>/dev/null; then
    echo -e "  AI Features:  ${BLUE}○ Optional (not configured)${NC}"
else
    echo -e "  AI Features:  ${GREEN}✓ Configured${NC}"
fi

# Show SSL status
SSL_ENABLED_CHECK=$(grep "^SSL_ENABLED=" .env 2>/dev/null | cut -d'=' -f2)
SSL_TYPE_CHECK=$(grep "^SSL_TYPE=" .env 2>/dev/null | cut -d'=' -f2)
SSL_DOMAIN_CHECK=$(grep "^SSL_DOMAIN=" .env 2>/dev/null | cut -d'=' -f2)
if [ "$SSL_ENABLED_CHECK" = "true" ]; then
    echo -e "  SSL/HTTPS:    ${GREEN}✓ Enabled (${SSL_TYPE_CHECK} - ${SSL_DOMAIN_CHECK})${NC}"
else
    echo -e "  SSL/HTTPS:    ${BLUE}○ Disabled (HTTP only)${NC}"
fi

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  Next Steps${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Determine deploy command based on SSL
DEPLOY_CMD="./scripts/deploy.sh --build"
if [ "$SSL_ENABLED_CHECK" = "true" ]; then
    DEPLOY_CMD="./scripts/deploy.sh --ssl --build"
fi

if [ "$NEEDS_CONFIG" = true ]; then
    echo -e "  ${YELLOW}1.${NC} Edit ${BLUE}.env${NC} file to configure:"
    grep -q "your-ldap-server" .env 2>/dev/null && echo -e "     • Common LDAP server settings"
    grep -q "your-dx-server" .env 2>/dev/null && echo -e "     • HCL DX server details"
    echo ""
    echo -e "  ${YELLOW}2.${NC} Deploy the application:"
    echo -e "     ${BLUE}${DEPLOY_CMD}${NC}"
else
    echo -e "  ${YELLOW}1.${NC} Deploy the application:"
    echo -e "     ${BLUE}${DEPLOY_CMD}${NC}"
fi

# Show LDAP-specific info
LDAP_MODE_FINAL=$(grep "^LDAP_MODE=" .env 2>/dev/null | cut -d'=' -f2)
echo ""
if [ "$LDAP_MODE_FINAL" = "local" ]; then
    echo -e "  ${CYAN}LDAP Deployment:${NC}"
    echo -e "     The deploy script will automatically start Local OpenLDAP"
    echo -e "     with pre-configured users and groups."
    echo ""
    echo -e "  ${YELLOW}LDAP Management (after deployment):${NC}"
    echo -e "     ${BLUE}./ldap/scripts/manage-ldap.sh list-users${NC}"
    echo -e "     ${BLUE}./ldap/scripts/manage-ldap.sh add-user <user> <pass> <first> <last>${NC}"
fi

echo ""
echo -e "  ${YELLOW}SSL/HTTPS Configuration:${NC}"
echo -e "     ${BLUE}./scripts/ssl-setup.sh self-signed${NC}     Generate self-signed cert"
echo -e "     ${BLUE}./scripts/ssl-setup.sh letsencrypt${NC}     Get Let's Encrypt cert"
echo -e "     ${BLUE}./scripts/ssl-setup.sh import${NC}          Import existing cert"
echo -e "     ${BLUE}./scripts/ssl-setup.sh status${NC}          Check certificate status"
echo ""
echo -e "  ${YELLOW}Other commands:${NC}"
echo -e "     ${BLUE}./scripts/deploy.sh --help${NC}      Show deployment options"
echo -e "     ${BLUE}./scripts/deploy.sh --status${NC}    Show service status"
echo -e "     ${BLUE}./scripts/deploy.sh --ssl${NC}       Deploy with SSL enabled"
echo -e "     ${BLUE}./scripts/dev.sh${NC}                Start local development"
echo -e "     ${BLUE}./scripts/health-check.sh${NC}       Check service status"
echo -e "     ${BLUE}./scripts/backup.sh${NC}             Backup database & files"
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${GREEN}Access Your Application${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
if [ "$SSL_ENABLED_CHECK" = "true" ]; then
    echo -e "  ${YELLOW}HTTPS (SSL Enabled):${NC}"
    echo -e "     ${GREEN}https://${APP_HOSTNAME_CHECK}${NC}  (port 443)"
    echo ""
    echo -e "  ${YELLOW}Note:${NC} HTTP on port 3000 redirects to HTTPS"
    echo -e "     http://${APP_HOSTNAME_CHECK}:3000 -> https://${APP_HOSTNAME_CHECK}"
else
    echo -e "  ${YELLOW}HTTP:${NC}"
    echo -e "     ${GREEN}http://${APP_HOSTNAME_CHECK}:3000${NC}"
fi
echo ""
echo -e "  ${YELLOW}API Endpoint:${NC}"
if [ "$SSL_ENABLED_CHECK" = "true" ]; then
    echo -e "     ${GREEN}https://${APP_HOSTNAME_CHECK}/api${NC}"
else
    echo -e "     ${GREEN}http://${APP_HOSTNAME_CHECK}:3000/api${NC}"
fi
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Documentation:"
echo -e "     ${BLUE}docs/HCL-DX-INTEGRATION.md${NC}      HCL DX API Integration"
echo -e "     ${BLUE}docs/LDAP-CONFIGURATION.md${NC}      LDAP Setup Guide"
echo -e "     ${BLUE}docs/AI-IMAGE-PROVIDERS.md${NC}      AI Image Providers"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
