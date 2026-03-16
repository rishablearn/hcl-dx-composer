#!/bin/bash
#===============================================================================
# HCL DX Composer - LDAP Management Script
#===============================================================================
# Utility script for managing Local OpenLDAP users and groups
#
# Usage:
#   ./ldap/scripts/manage-ldap.sh list-users
#   ./ldap/scripts/manage-ldap.sh list-groups
#   ./ldap/scripts/manage-ldap.sh add-user <username> <password> <firstname> <lastname> <email>
#   ./ldap/scripts/manage-ldap.sh add-to-group <username> <groupname>
#   ./ldap/scripts/manage-ldap.sh remove-from-group <username> <groupname>
#   ./ldap/scripts/manage-ldap.sh change-password <username> <newpassword>
#   ./ldap/scripts/manage-ldap.sh delete-user <username>
#   ./ldap/scripts/manage-ldap.sh test-auth <username> <password>
#===============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
LDAP_HOST="${LDAP_HOST:-localhost}"
LDAP_PORT="${LDAP_PORT:-389}"
LDAP_ADMIN_DN="${LDAP_ADMIN_DN:-cn=admin,dc=hcldx,dc=local}"
LDAP_ADMIN_PASSWORD="${LDAP_ADMIN_PASSWORD:-admin_password}"
LDAP_BASE_DN="${LDAP_BASE_DN:-dc=hcldx,dc=local}"
LDAP_USER_BASE="${LDAP_USER_BASE:-ou=Users,dc=hcldx,dc=local}"
LDAP_GROUP_BASE="${LDAP_GROUP_BASE:-ou=Groups,dc=hcldx,dc=local}"

LDAP_URL="ldap://${LDAP_HOST}:${LDAP_PORT}"

# Helper function for ldapsearch
ldap_search() {
    ldapsearch -x -H "${LDAP_URL}" \
        -D "${LDAP_ADMIN_DN}" -w "${LDAP_ADMIN_PASSWORD}" \
        "$@"
}

# Helper function for ldapadd
ldap_add() {
    ldapadd -x -H "${LDAP_URL}" \
        -D "${LDAP_ADMIN_DN}" -w "${LDAP_ADMIN_PASSWORD}" \
        "$@"
}

# Helper function for ldapmodify
ldap_modify() {
    ldapmodify -x -H "${LDAP_URL}" \
        -D "${LDAP_ADMIN_DN}" -w "${LDAP_ADMIN_PASSWORD}" \
        "$@"
}

# Helper function for ldapdelete
ldap_delete() {
    ldapdelete -x -H "${LDAP_URL}" \
        -D "${LDAP_ADMIN_DN}" -w "${LDAP_ADMIN_PASSWORD}" \
        "$@"
}

# Get next available UID number
get_next_uid() {
    local max_uid=$(ldap_search -b "${LDAP_USER_BASE}" "(objectClass=posixAccount)" uidNumber 2>/dev/null | \
        grep "^uidNumber:" | awk '{print $2}' | sort -n | tail -1)
    echo $((max_uid + 1))
}

# List all users
list_users() {
    echo -e "${CYAN}Users in ${LDAP_USER_BASE}:${NC}"
    echo ""
    ldap_search -b "${LDAP_USER_BASE}" "(objectClass=inetOrgPerson)" uid cn mail description 2>/dev/null | \
        grep -E "^(dn|uid|cn|mail|description):" | \
        while IFS= read -r line; do
            if [[ $line == dn:* ]]; then
                echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            fi
            echo "  $line"
        done
    echo ""
}

# List all groups
list_groups() {
    echo -e "${CYAN}Groups in ${LDAP_GROUP_BASE}:${NC}"
    echo ""
    ldap_search -b "${LDAP_GROUP_BASE}" "(objectClass=groupOfNames)" cn member description 2>/dev/null | \
        grep -E "^(dn|cn|member|description):" | \
        while IFS= read -r line; do
            if [[ $line == dn:* ]]; then
                echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            fi
            echo "  $line"
        done
    echo ""
}

# Add a new user
add_user() {
    local username="$1"
    local password="$2"
    local firstname="$3"
    local lastname="$4"
    local email="$5"
    
    if [ -z "$username" ] || [ -z "$password" ] || [ -z "$firstname" ] || [ -z "$lastname" ]; then
        echo -e "${RED}Usage: $0 add-user <username> <password> <firstname> <lastname> [email]${NC}"
        exit 1
    fi
    
    local uid_number=$(get_next_uid)
    local user_dn="uid=${username},${LDAP_USER_BASE}"
    local email="${email:-${username}@hcldx.local}"
    
    echo -e "${BLUE}Adding user: ${username}${NC}"
    
    cat << EOF | ldap_add
dn: ${user_dn}
objectClass: inetOrgPerson
objectClass: posixAccount
objectClass: shadowAccount
uid: ${username}
sn: ${lastname}
givenName: ${firstname}
cn: ${firstname} ${lastname}
displayName: ${firstname} ${lastname}
uidNumber: ${uid_number}
gidNumber: 1000
homeDirectory: /home/${username}
loginShell: /bin/bash
mail: ${email}
userPassword: ${password}
description: Added via manage-ldap.sh
EOF

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ User '${username}' added successfully${NC}"
        echo -e "  DN: ${user_dn}"
        echo -e "  UID Number: ${uid_number}"
    else
        echo -e "${RED}✗ Failed to add user '${username}'${NC}"
        exit 1
    fi
}

# Add user to group
add_to_group() {
    local username="$1"
    local groupname="$2"
    
    if [ -z "$username" ] || [ -z "$groupname" ]; then
        echo -e "${RED}Usage: $0 add-to-group <username> <groupname>${NC}"
        exit 1
    fi
    
    local user_dn="uid=${username},${LDAP_USER_BASE}"
    local group_dn="cn=${groupname},${LDAP_GROUP_BASE}"
    
    echo -e "${BLUE}Adding '${username}' to group '${groupname}'${NC}"
    
    cat << EOF | ldap_modify
dn: ${group_dn}
changetype: modify
add: member
member: ${user_dn}
EOF

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ User '${username}' added to group '${groupname}'${NC}"
    else
        echo -e "${RED}✗ Failed to add user to group${NC}"
        exit 1
    fi
}

# Remove user from group
remove_from_group() {
    local username="$1"
    local groupname="$2"
    
    if [ -z "$username" ] || [ -z "$groupname" ]; then
        echo -e "${RED}Usage: $0 remove-from-group <username> <groupname>${NC}"
        exit 1
    fi
    
    local user_dn="uid=${username},${LDAP_USER_BASE}"
    local group_dn="cn=${groupname},${LDAP_GROUP_BASE}"
    
    echo -e "${BLUE}Removing '${username}' from group '${groupname}'${NC}"
    
    cat << EOF | ldap_modify
dn: ${group_dn}
changetype: modify
delete: member
member: ${user_dn}
EOF

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ User '${username}' removed from group '${groupname}'${NC}"
    else
        echo -e "${RED}✗ Failed to remove user from group${NC}"
        exit 1
    fi
}

# Change user password
change_password() {
    local username="$1"
    local newpassword="$2"
    
    if [ -z "$username" ] || [ -z "$newpassword" ]; then
        echo -e "${RED}Usage: $0 change-password <username> <newpassword>${NC}"
        exit 1
    fi
    
    local user_dn="uid=${username},${LDAP_USER_BASE}"
    
    echo -e "${BLUE}Changing password for '${username}'${NC}"
    
    cat << EOF | ldap_modify
dn: ${user_dn}
changetype: modify
replace: userPassword
userPassword: ${newpassword}
EOF

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Password changed for '${username}'${NC}"
    else
        echo -e "${RED}✗ Failed to change password${NC}"
        exit 1
    fi
}

# Delete user
delete_user() {
    local username="$1"
    
    if [ -z "$username" ]; then
        echo -e "${RED}Usage: $0 delete-user <username>${NC}"
        exit 1
    fi
    
    local user_dn="uid=${username},${LDAP_USER_BASE}"
    
    echo -e "${YELLOW}Warning: This will permanently delete user '${username}'${NC}"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Cancelled${NC}"
        exit 0
    fi
    
    echo -e "${BLUE}Deleting user '${username}'${NC}"
    
    ldap_delete "${user_dn}"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ User '${username}' deleted${NC}"
    else
        echo -e "${RED}✗ Failed to delete user${NC}"
        exit 1
    fi
}

# Test user authentication
test_auth() {
    local username="$1"
    local password="$2"
    
    if [ -z "$username" ] || [ -z "$password" ]; then
        echo -e "${RED}Usage: $0 test-auth <username> <password>${NC}"
        exit 1
    fi
    
    local user_dn="uid=${username},${LDAP_USER_BASE}"
    
    echo -e "${BLUE}Testing authentication for '${username}'${NC}"
    
    if ldapwhoami -x -H "${LDAP_URL}" -D "${user_dn}" -w "${password}" 2>/dev/null; then
        echo -e "${GREEN}✓ Authentication successful for '${username}'${NC}"
    else
        echo -e "${RED}✗ Authentication failed for '${username}'${NC}"
        exit 1
    fi
}

# Show help
show_help() {
    echo -e "${CYAN}HCL DX Composer - LDAP Management Script${NC}"
    echo ""
    echo "Usage: $0 <command> [arguments]"
    echo ""
    echo "Commands:"
    echo "  list-users                                    List all users"
    echo "  list-groups                                   List all groups"
    echo "  add-user <user> <pass> <first> <last> [email] Add new user"
    echo "  add-to-group <username> <groupname>           Add user to group"
    echo "  remove-from-group <username> <groupname>      Remove user from group"
    echo "  change-password <username> <newpassword>      Change user password"
    echo "  delete-user <username>                        Delete user"
    echo "  test-auth <username> <password>               Test authentication"
    echo ""
    echo "Environment Variables:"
    echo "  LDAP_HOST          LDAP server host (default: localhost)"
    echo "  LDAP_PORT          LDAP server port (default: 389)"
    echo "  LDAP_ADMIN_DN      Admin bind DN"
    echo "  LDAP_ADMIN_PASSWORD Admin password"
    echo ""
}

# Main
case "${1:-help}" in
    list-users)
        list_users
        ;;
    list-groups)
        list_groups
        ;;
    add-user)
        add_user "$2" "$3" "$4" "$5" "$6"
        ;;
    add-to-group)
        add_to_group "$2" "$3"
        ;;
    remove-from-group)
        remove_from_group "$2" "$3"
        ;;
    change-password)
        change_password "$2" "$3"
        ;;
    delete-user)
        delete_user "$2"
        ;;
    test-auth)
        test_auth "$2" "$3"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        show_help
        exit 1
        ;;
esac
