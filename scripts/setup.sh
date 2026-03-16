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
    # Frontend Configuration
    #---------------------------------------------------------------------------
    print_step "Frontend Configuration"
    print_info "Settings for the React frontend application."
    echo ""
    
    prompt_input "Frontend port" "3000" FRONTEND_PORT
    prompt_input "API base URL" "http://localhost:${BACKEND_PORT}/api" VITE_API_BASE_URL
    
    #---------------------------------------------------------------------------
    # LDAP Configuration
    #---------------------------------------------------------------------------
    print_step "LDAP/Active Directory Configuration"
    print_info "Configure connection to your organization's Active Directory."
    print_info "This enables enterprise SSO authentication."
    echo ""
    
    CONFIGURE_LDAP=false
    if [ "$INTERACTIVE" = true ]; then
        if prompt_yes_no "Configure LDAP/Active Directory now?" "N"; then
            CONFIGURE_LDAP=true
        fi
    fi
    
    if [ "$CONFIGURE_LDAP" = true ]; then
        prompt_input "LDAP server URL (e.g., ldap://ad-server:389)" "ldap://your-ad-server:389" LDAP_URL
        prompt_input "Base DN (e.g., DC=company,DC=com)" "DC=domain,DC=com" LDAP_BASE_DN
        prompt_input "Bind DN (service account)" "CN=ServiceAccount,OU=ServiceAccounts,DC=domain,DC=com" LDAP_BIND_DN
        prompt_secret "Bind password" LDAP_BIND_PASSWORD
        LDAP_BIND_PASSWORD="${LDAP_BIND_PASSWORD:-your_ldap_password}"
        prompt_input "User search base" "OU=Users,DC=domain,DC=com" LDAP_USER_SEARCH_BASE
        prompt_input "Group search base" "OU=Groups,DC=domain,DC=com" LDAP_GROUP_SEARCH_BASE
    else
        LDAP_URL="ldap://your-ad-server:389"
        LDAP_BASE_DN="DC=domain,DC=com"
        LDAP_BIND_DN="CN=ServiceAccount,OU=ServiceAccounts,DC=domain,DC=com"
        LDAP_BIND_PASSWORD="your_ldap_password"
        LDAP_USER_SEARCH_BASE="OU=Users,DC=domain,DC=com"
        LDAP_GROUP_SEARCH_BASE="OU=Groups,DC=domain,DC=com"
        print_warning "LDAP not configured. Update .env file later to enable SSO."
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
    AI_IMAGE_PROVIDER="gemini"
    
    if [ "$CONFIGURE_AI" = true ]; then
        echo ""
        echo -e "${YELLOW}Select AI Provider:${NC}"
        echo ""
        echo "  1) Google Gemini (FREE) - Recommended for most users"
        echo "     • 500 free images/day"
        echo "     • Model: gemini-2.5-flash-image / gemini-3.1-flash-image-preview"
        echo "     • Get API key: https://aistudio.google.com/apikey"
        echo ""
        echo "  2) Hugging Face (FREE) - Open-source models"
        echo "     • Limited free inference API requests"
        echo "     • Models: FLUX.1, Stable Diffusion XL"
        echo "     • Get API key: https://huggingface.co/settings/tokens"
        echo ""
        echo "  3) OpenAI DALL-E (PAID) - High quality"
        echo "     • Pay-per-image pricing"
        echo "     • Model: DALL-E 3"
        echo "     • Get API key: https://platform.openai.com/api-keys"
        echo ""
        echo "  4) Stability AI (PAID) - Fine artistic control"
        echo "     • Pay-per-image pricing"
        echo "     • Models: SDXL, Stable Diffusion 3"
        echo "     • Get API key: https://platform.stability.ai/account/keys"
        echo ""
        read -p "Enter choice [1]: " ai_choice
        ai_choice="${ai_choice:-1}"
        
        case "$ai_choice" in
            1)
                AI_IMAGE_PROVIDER="gemini"
                echo ""
                print_info "Google Gemini selected (FREE tier available)"
                prompt_secret "Enter Google AI API key (from AI Studio)" GOOGLE_AI_API_KEY
                ;;
            2)
                AI_IMAGE_PROVIDER="huggingface"
                echo ""
                print_info "Hugging Face selected (FREE tier available)"
                prompt_secret "Enter Hugging Face API token" HUGGINGFACE_API_KEY
                prompt_input "Hugging Face model" "black-forest-labs/FLUX.1-schnell" HUGGINGFACE_MODEL
                ;;
            3)
                AI_IMAGE_PROVIDER="openai"
                echo ""
                print_info "OpenAI DALL-E selected (Paid)"
                prompt_secret "Enter OpenAI API key" OPENAI_API_KEY
                ;;
            4)
                AI_IMAGE_PROVIDER="stability"
                echo ""
                print_info "Stability AI selected (Paid)"
                prompt_secret "Enter Stability AI API key" STABILITY_API_KEY
                ;;
            *)
                AI_IMAGE_PROVIDER="gemini"
                print_warning "Invalid choice, defaulting to Google Gemini"
                prompt_secret "Enter Google AI API key" GOOGLE_AI_API_KEY
                ;;
        esac
        
        print_success "AI provider configured: ${AI_IMAGE_PROVIDER}"
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
# FRONTEND CONFIGURATION
# 
# React application settings
# VITE_API_BASE_URL: Backend API endpoint for frontend to connect to
#===============================================================================
FRONTEND_PORT=${FRONTEND_PORT}
VITE_API_BASE_URL=${VITE_API_BASE_URL}

#===============================================================================
# LDAP / ACTIVE DIRECTORY CONFIGURATION
# 
# Enterprise Single Sign-On (SSO) settings
# Connect to your organization's Active Directory for user authentication
#
# LDAP_URL: Your AD server (ldap:// for port 389, ldaps:// for port 636)
# LDAP_BASE_DN: Root of your directory tree
# LDAP_BIND_DN: Service account with read access to AD
# LDAP_BIND_PASSWORD: Service account password
#===============================================================================
LDAP_URL=${LDAP_URL}
LDAP_BASE_DN=${LDAP_BASE_DN}
LDAP_BIND_DN=${LDAP_BIND_DN}
LDAP_BIND_PASSWORD=${LDAP_BIND_PASSWORD}
LDAP_USER_SEARCH_BASE=${LDAP_USER_SEARCH_BASE}
LDAP_GROUP_SEARCH_BASE=${LDAP_GROUP_SEARCH_BASE}

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
# FREE TIER OPTIONS:
# ─────────────────────────────────────────────────────────────────────────────
# Google Gemini (RECOMMENDED)
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
# AI_IMAGE_PROVIDER: 'gemini', 'huggingface', 'openai', or 'stability'
#===============================================================================
AI_IMAGE_PROVIDER=${AI_IMAGE_PROVIDER}

# Google Gemini (FREE - Recommended)
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

# Create .gitkeep files to preserve empty directories in git
touch uploads/.gitkeep
touch uploads/ai-generated/.gitkeep
touch uploads/thumbnails/.gitkeep
touch logs/.gitkeep
touch backups/.gitkeep

print_success "Created: uploads/, uploads/ai-generated/, uploads/thumbnails/"
print_success "Created: logs/, backups/"

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
echo -e "  Database:     ${GREEN}PostgreSQL${NC} on port ${YELLOW}${POSTGRES_PORT:-5432}${NC}"
echo -e "  Backend API:  ${GREEN}Node.js${NC} on port ${YELLOW}${BACKEND_PORT:-3001}${NC}"
echo -e "  Frontend:     ${GREEN}React${NC} on port ${YELLOW}${FRONTEND_PORT:-3000}${NC}"
echo ""

# Check what needs configuration
NEEDS_CONFIG=false
if grep -q "your-ad-server" .env 2>/dev/null; then
    echo -e "  LDAP:         ${YELLOW}⚠ Not configured${NC}"
    NEEDS_CONFIG=true
else
    echo -e "  LDAP:         ${GREEN}✓ Configured${NC}"
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

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  Next Steps${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$NEEDS_CONFIG" = true ]; then
    echo -e "  ${YELLOW}1.${NC} Edit ${BLUE}.env${NC} file to configure:"
    grep -q "your-ad-server" .env 2>/dev/null && echo -e "     • LDAP/Active Directory settings"
    grep -q "your-dx-server" .env 2>/dev/null && echo -e "     • HCL DX server details"
    echo ""
    echo -e "  ${YELLOW}2.${NC} Deploy the application:"
    echo -e "     ${BLUE}./scripts/deploy.sh --build${NC}"
else
    echo -e "  ${YELLOW}1.${NC} Deploy the application:"
    echo -e "     ${BLUE}./scripts/deploy.sh --build${NC}"
fi

echo ""
echo -e "  ${YELLOW}Other commands:${NC}"
echo -e "     ${BLUE}./scripts/deploy.sh --help${NC}      Show deployment options"
echo -e "     ${BLUE}./scripts/dev.sh${NC}                Start local development"
echo -e "     ${BLUE}./scripts/health-check.sh${NC}       Check service status"
echo -e "     ${BLUE}./scripts/backup.sh${NC}             Backup database & files"
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Documentation: ${BLUE}docs/HCL-DX-INTEGRATION.md${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
