#!/bin/bash
#===============================================================================
# HCL DX Composer - LDAP Initialization Script
#===============================================================================
# This script initializes the Local OpenLDAP with users and groups
# Run this after starting the OpenLDAP container for the first time
#
# Usage: ./ldap/scripts/init-ldap.sh
#===============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
LDAP_HOST="${LDAP_HOST:-localhost}"
LDAP_PORT="${LDAP_PORT:-389}"
LDAP_ADMIN_DN="${LDAP_ADMIN_DN:-cn=admin,dc=hcldx,dc=local}"
LDAP_ADMIN_PASSWORD="${LDAP_ADMIN_PASSWORD:-admin_password}"
LDAP_BASE_DN="${LDAP_BASE_DN:-dc=hcldx,dc=local}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOOTSTRAP_DIR="${SCRIPT_DIR}/../bootstrap"

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  HCL DX Composer - LDAP Initialization${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Function to check if LDAP is ready
wait_for_ldap() {
    echo -e "${YELLOW}Waiting for LDAP server to be ready...${NC}"
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if ldapsearch -x -H "ldap://${LDAP_HOST}:${LDAP_PORT}" -b "" -s base "(objectclass=*)" >/dev/null 2>&1; then
            echo -e "${GREEN}✓ LDAP server is ready${NC}"
            return 0
        fi
        echo -e "  Attempt ${attempt}/${max_attempts}..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}✗ LDAP server not ready after ${max_attempts} attempts${NC}"
    return 1
}

# Function to check if base DN exists
check_base_dn() {
    if ldapsearch -x -H "ldap://${LDAP_HOST}:${LDAP_PORT}" \
        -D "${LDAP_ADMIN_DN}" -w "${LDAP_ADMIN_PASSWORD}" \
        -b "${LDAP_BASE_DN}" -s base "(objectclass=*)" >/dev/null 2>&1; then
        return 0
    fi
    return 1
}

# Function to check if OU exists
check_ou_exists() {
    local ou_dn="$1"
    if ldapsearch -x -H "ldap://${LDAP_HOST}:${LDAP_PORT}" \
        -D "${LDAP_ADMIN_DN}" -w "${LDAP_ADMIN_PASSWORD}" \
        -b "${ou_dn}" -s base "(objectclass=*)" >/dev/null 2>&1; then
        return 0
    fi
    return 1
}

# Function to load LDIF file
load_ldif() {
    local ldif_file="$1"
    local description="$2"
    
    if [ ! -f "$ldif_file" ]; then
        echo -e "${RED}✗ LDIF file not found: ${ldif_file}${NC}"
        return 1
    fi
    
    echo -e "${BLUE}Loading: ${description}${NC}"
    
    if ldapadd -x -H "ldap://${LDAP_HOST}:${LDAP_PORT}" \
        -D "${LDAP_ADMIN_DN}" -w "${LDAP_ADMIN_PASSWORD}" \
        -f "${ldif_file}" -c 2>/dev/null; then
        echo -e "${GREEN}  ✓ Loaded successfully${NC}"
        return 0
    else
        echo -e "${YELLOW}  ⚠ Some entries may already exist (continuing)${NC}"
        return 0
    fi
}

# Main execution
main() {
    # Check for ldapsearch command
    if ! command -v ldapsearch &> /dev/null; then
        echo -e "${RED}Error: ldapsearch command not found${NC}"
        echo -e "Install LDAP utilities:"
        echo -e "  macOS: brew install openldap"
        echo -e "  Ubuntu/Debian: apt-get install ldap-utils"
        echo -e "  CentOS/RHEL: yum install openldap-clients"
        exit 1
    fi
    
    # Wait for LDAP server
    wait_for_ldap || exit 1
    
    echo ""
    echo -e "${CYAN}Loading LDAP bootstrap files...${NC}"
    echo ""
    
    # Check if already initialized
    if check_ou_exists "ou=Users,${LDAP_BASE_DN}"; then
        echo -e "${YELLOW}⚠ LDAP appears to be already initialized${NC}"
        echo -e "  Users OU exists at: ou=Users,${LDAP_BASE_DN}"
        echo ""
        read -p "Do you want to continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${BLUE}Exiting without changes${NC}"
            exit 0
        fi
    fi
    
    # Load bootstrap files in order
    load_ldif "${BOOTSTRAP_DIR}/01-base.ldif" "Base organizational structure"
    load_ldif "${BOOTSTRAP_DIR}/02-users.ldif" "User accounts"
    load_ldif "${BOOTSTRAP_DIR}/03-groups.ldif" "Groups and role mappings"
    
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  LDAP Initialization Complete!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${CYAN}Pre-configured Users (password: 'password'):${NC}"
    echo -e "  • ${YELLOW}admin${NC}     - System Administrator"
    echo -e "  • ${YELLOW}author${NC}    - Content Author"
    echo -e "  • ${YELLOW}author2${NC}   - Secondary Author"
    echo -e "  • ${YELLOW}reviewer${NC}  - Content Reviewer"
    echo -e "  • ${YELLOW}reviewer2${NC} - Secondary Reviewer"
    echo -e "  • ${YELLOW}publisher${NC} - Content Publisher"
    echo ""
    echo -e "${CYAN}Pre-configured Groups:${NC}"
    echo -e "  • ${YELLOW}Admins${NC}     - System administrators"
    echo -e "  • ${YELLOW}Authors${NC}    - Content creators"
    echo -e "  • ${YELLOW}Reviewers${NC}  - Content approvers"
    echo -e "  • ${YELLOW}Publishers${NC} - HCL DX publishers"
    echo -e "  • ${YELLOW}AllUsers${NC}   - All users"
    echo ""
}

main "$@"
