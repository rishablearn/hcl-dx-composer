#!/bin/bash
#===============================================================================
# HCL DX Composer - LDAP Diagnostic Script
#===============================================================================
# This script diagnoses LDAP issues and shows all populated users
#
# Usage: ./scripts/ldap-diagnostic.sh
#===============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -f "${PROJECT_DIR}/.env" ]; then
    source "${PROJECT_DIR}/.env" 2>/dev/null || true
fi

LDAP_ADMIN_PASSWORD="${LDAP_ADMIN_PASSWORD:-admin_password}"
CONTAINER_NAME="${LDAP_CONTAINER_NAME:-hcl-dx-openldap}"
BASE_DN="dc=hcldx,dc=local"
ADMIN_DN="cn=admin,${BASE_DN}"

print_header() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_section() {
    echo ""
    echo -e "${BLUE}▶ $1${NC}"
    echo -e "${BLUE}────────────────────────────────────────────${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${MAGENTA}  $1${NC}"
}

print_header "HCL DX Composer - LDAP Diagnostic"

#===============================================================================
# 1. Check Docker
#===============================================================================
print_section "1. Docker Check"

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    exit 1
fi
print_success "Docker is installed"

#===============================================================================
# 2. Check Container
#===============================================================================
print_section "2. Container Status"

if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    print_error "LDAP container '${CONTAINER_NAME}' does not exist"
    echo ""
    echo -e "${YELLOW}Fix: Run ./scripts/deploy.sh --ssl --build${NC}"
    exit 1
fi
print_success "Container exists: ${CONTAINER_NAME}"

CONTAINER_STATUS=$(docker inspect -f '{{.State.Status}}' ${CONTAINER_NAME} 2>/dev/null)
if [ "$CONTAINER_STATUS" != "running" ]; then
    print_error "Container is not running (status: ${CONTAINER_STATUS})"
    echo ""
    echo -e "${YELLOW}Fix: docker start ${CONTAINER_NAME}${NC}"
    exit 1
fi
print_success "Container is running"

#===============================================================================
# 3. Check LDAP Connection
#===============================================================================
print_section "3. LDAP Connection Test"

if docker exec ${CONTAINER_NAME} ldapsearch -x -H ldap://localhost -b "" -s base "(objectclass=*)" >/dev/null 2>&1; then
    print_success "Anonymous bind works"
else
    print_warning "Anonymous bind failed (may be disabled)"
fi

if docker exec ${CONTAINER_NAME} ldapsearch -x -H ldap://localhost -b "${BASE_DN}" -D "${ADMIN_DN}" -w "${LDAP_ADMIN_PASSWORD}" "(objectClass=*)" >/dev/null 2>&1; then
    print_success "Admin bind successful"
else
    print_error "Admin bind FAILED"
    echo ""
    echo -e "${YELLOW}Check LDAP_ADMIN_PASSWORD in .env (current: ${LDAP_ADMIN_PASSWORD})${NC}"
fi

#===============================================================================
# 4. Check Base DN Structure
#===============================================================================
print_section "4. Directory Structure"

echo -e "${CYAN}Base DN:${NC}"
BASEDN_COUNT=$(docker exec ${CONTAINER_NAME} ldapsearch -x -H ldap://localhost -b "${BASE_DN}" -D "${ADMIN_DN}" -w "${LDAP_ADMIN_PASSWORD}" -s base "(objectClass=*)" 2>/dev/null | grep -c "^dn:" || echo "0")
if [ "$BASEDN_COUNT" -gt "0" ]; then
    print_success "Base DN exists: ${BASE_DN}"
else
    print_error "Base DN does not exist: ${BASE_DN}"
fi

echo ""
echo -e "${CYAN}Organizational Units:${NC}"

# Check Users OU
USERS_OU=$(docker exec ${CONTAINER_NAME} ldapsearch -x -H ldap://localhost -b "ou=Users,${BASE_DN}" -D "${ADMIN_DN}" -w "${LDAP_ADMIN_PASSWORD}" -s base "(objectClass=*)" 2>/dev/null | grep -c "^dn:" | tr -d '\n' || echo "0")
if [ "$USERS_OU" -gt "0" ]; then
    print_success "ou=Users exists"
else
    print_error "ou=Users MISSING - Users cannot be created!"
fi

# Check Groups OU
GROUPS_OU=$(docker exec ${CONTAINER_NAME} ldapsearch -x -H ldap://localhost -b "ou=Groups,${BASE_DN}" -D "${ADMIN_DN}" -w "${LDAP_ADMIN_PASSWORD}" -s base "(objectClass=*)" 2>/dev/null | grep -c "^dn:" | tr -d '\n' || echo "0")
if [ "$GROUPS_OU" -gt "0" ]; then
    print_success "ou=Groups exists"
else
    print_error "ou=Groups MISSING"
fi

#===============================================================================
# 5. List All Users
#===============================================================================
print_section "5. LDAP Users"

USER_SEARCH=$(docker exec ${CONTAINER_NAME} ldapsearch -x -H ldap://localhost -b "ou=Users,${BASE_DN}" -D "${ADMIN_DN}" -w "${LDAP_ADMIN_PASSWORD}" "(uid=*)" uid cn mail displayName 2>&1)

if echo "$USER_SEARCH" | grep -q "No such object"; then
    print_error "Cannot list users - ou=Users does not exist!"
    echo ""
    echo -e "${YELLOW}Fix: Run ./scripts/populate-ldap.sh${NC}"
else
    USER_COUNT=$(echo "$USER_SEARCH" | grep -c "^dn:" | tr -d '\n' || echo "0")
    
    if [ "$USER_COUNT" -eq "0" ]; then
        print_warning "No users found in LDAP"
        echo ""
        echo -e "${YELLOW}Fix: Run ./scripts/populate-ldap.sh${NC}"
    else
        print_success "Found ${USER_COUNT} users:"
        echo ""
        
        # Parse and display each user
        echo "$USER_SEARCH" | awk '
        /^dn:/ { 
            if (uid != "") {
                printf "  • %-12s %-25s %s\n", uid, cn, mail
            }
            uid = ""; cn = ""; mail = ""; displayName = ""
        }
        /^uid:/ { gsub(/^uid: /, ""); uid = $0 }
        /^cn:/ { gsub(/^cn: /, ""); cn = $0 }
        /^mail:/ { gsub(/^mail: /, ""); mail = $0 }
        /^displayName:/ { gsub(/^displayName: /, ""); displayName = $0 }
        END {
            if (uid != "") {
                printf "  • %-12s %-25s %s\n", uid, cn, mail
            }
        }
        '
    fi
fi

#===============================================================================
# 6. List All Groups
#===============================================================================
print_section "6. LDAP Groups"

GROUP_SEARCH=$(docker exec ${CONTAINER_NAME} ldapsearch -x -H ldap://localhost -b "ou=Groups,${BASE_DN}" -D "${ADMIN_DN}" -w "${LDAP_ADMIN_PASSWORD}" "(objectClass=groupOfNames)" cn member 2>&1)

if echo "$GROUP_SEARCH" | grep -q "No such object"; then
    print_warning "Cannot list groups - ou=Groups does not exist"
else
    GROUP_COUNT=$(echo "$GROUP_SEARCH" | grep -c "^dn:" | tr -d '\n' || echo "0")
    
    if [ "$GROUP_COUNT" -eq "0" ]; then
        print_warning "No groups found in LDAP"
    else
        print_success "Found ${GROUP_COUNT} groups:"
        echo ""
        echo "$GROUP_SEARCH" | grep "^cn:" | sed 's/cn: /  • /'
    fi
fi

#===============================================================================
# 7. Test User Authentication
#===============================================================================
print_section "7. Authentication Test"

TEST_USER="admin"
TEST_PASSWORD="password"

echo -e "${CYAN}Testing login for user: ${TEST_USER}${NC}"

# First find the user DN
USER_DN=$(docker exec ${CONTAINER_NAME} ldapsearch -x -H ldap://localhost -b "ou=Users,${BASE_DN}" -D "${ADMIN_DN}" -w "${LDAP_ADMIN_PASSWORD}" "(uid=${TEST_USER})" dn 2>/dev/null | grep "^dn:" | sed 's/dn: //')

if [ -z "$USER_DN" ]; then
    print_error "User '${TEST_USER}' not found in LDAP"
    echo ""
    echo -e "${YELLOW}This is why login is failing!${NC}"
    echo -e "${YELLOW}Fix: Run ./scripts/populate-ldap.sh to create users${NC}"
else
    print_success "User found: ${USER_DN}"
    
    # Try to bind as the user
    if docker exec ${CONTAINER_NAME} ldapwhoami -x -H ldap://localhost -D "${USER_DN}" -w "${TEST_PASSWORD}" >/dev/null 2>&1; then
        print_success "Authentication successful for ${TEST_USER}!"
    else
        print_error "Authentication FAILED for ${TEST_USER}"
        echo ""
        echo -e "${YELLOW}Password may be incorrect. Expected: 'password'${NC}"
    fi
fi

#===============================================================================
# 8. Check Backend LDAP Configuration
#===============================================================================
print_section "8. Backend LDAP Configuration"

if [ -f "${PROJECT_DIR}/.env" ]; then
    echo -e "${CYAN}Current .env LDAP settings:${NC}"
    echo ""
    
    LDAP_URL=$(grep "^LDAP_URL=" "${PROJECT_DIR}/.env" 2>/dev/null | cut -d'=' -f2-)
    LDAP_BASE_DN=$(grep "^LDAP_BASE_DN=" "${PROJECT_DIR}/.env" 2>/dev/null | cut -d'=' -f2-)
    LDAP_BIND_DN=$(grep "^LDAP_BIND_DN=" "${PROJECT_DIR}/.env" 2>/dev/null | cut -d'=' -f2-)
    LDAP_USER_SEARCH_BASE=$(grep "^LDAP_USER_SEARCH_BASE=" "${PROJECT_DIR}/.env" 2>/dev/null | cut -d'=' -f2-)
    
    [ -n "$LDAP_URL" ] && print_info "LDAP_URL = $LDAP_URL" || print_error "LDAP_URL not set"
    [ -n "$LDAP_BASE_DN" ] && print_info "LDAP_BASE_DN = $LDAP_BASE_DN" || print_error "LDAP_BASE_DN not set"
    [ -n "$LDAP_BIND_DN" ] && print_info "LDAP_BIND_DN = $LDAP_BIND_DN" || print_error "LDAP_BIND_DN not set"
    [ -n "$LDAP_USER_SEARCH_BASE" ] && print_info "LDAP_USER_SEARCH_BASE = $LDAP_USER_SEARCH_BASE" || print_warning "LDAP_USER_SEARCH_BASE not set (using LDAP_BASE_DN)"
    
    # Check if URL points to correct host
    if [ -n "$LDAP_URL" ]; then
        echo ""
        if echo "$LDAP_URL" | grep -q "openldap:389"; then
            print_success "LDAP_URL correctly points to Docker container"
        elif echo "$LDAP_URL" | grep -q "localhost:389"; then
            print_warning "LDAP_URL uses localhost - should be 'ldap://openldap:389' for Docker"
        fi
    fi
else
    print_error ".env file not found at ${PROJECT_DIR}/.env"
fi

#===============================================================================
# 9. Summary and Recommendations
#===============================================================================
print_header "Diagnostic Summary"

ISSUES=0

if [ "${USERS_OU:-0}" = "0" ]; then
    print_error "CRITICAL: ou=Users does not exist"
    ISSUES=$((ISSUES + 1))
fi

if [ "${USER_COUNT:-0}" = "0" ]; then
    print_error "CRITICAL: No users in LDAP"
    ISSUES=$((ISSUES + 1))
fi

if [ -z "$USER_DN" ]; then
    print_error "CRITICAL: Test user 'admin' not found"
    ISSUES=$((ISSUES + 1))
fi

if [ "$ISSUES" -gt "0" ]; then
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  FIX: Run the following command to populate LDAP:${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${GREEN}  ./scripts/populate-ldap.sh${NC}"
    echo ""
else
    echo ""
    print_success "All LDAP checks passed!"
    echo ""
    echo -e "${GREEN}Users can login with:${NC}"
    echo -e "  Username: ${YELLOW}admin${NC} (or author, reviewer, publisher)"
    echo -e "  Password: ${YELLOW}password${NC}"
fi

echo ""
