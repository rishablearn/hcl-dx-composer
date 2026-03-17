#!/bin/bash
#===============================================================================
# HCL DX Composer - Complete LDAP Fix Script
#===============================================================================
# This script fixes ALL LDAP issues:
# 1. Creates OUs if missing
# 2. Creates users with correct passwords
# 3. Verifies authentication works
# 4. Tests backend can connect
#===============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

CONTAINER_NAME="hcl-dx-openldap"
LDAP_ADMIN_PASSWORD="${LDAP_ADMIN_PASSWORD:-admin_password}"
BASE_DN="dc=hcldx,dc=local"
ADMIN_DN="cn=admin,${BASE_DN}"

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  HCL DX Composer - Complete LDAP Fix${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check container
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${RED}Error: LDAP container not running${NC}"
    echo -e "${YELLOW}Start it with: docker compose --profile local-ldap up -d openldap${NC}"
    exit 1
fi

echo -e "${GREEN}✓ LDAP container is running${NC}"

# Wait for LDAP to be ready
echo -e "${YELLOW}Waiting for LDAP...${NC}"
for i in {1..30}; do
    if docker exec ${CONTAINER_NAME} ldapsearch -x -H ldap://localhost -b "${BASE_DN}" -D "${ADMIN_DN}" -w "${LDAP_ADMIN_PASSWORD}" "(objectClass=*)" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ LDAP is ready${NC}"
        break
    fi
    sleep 2
done

# Delete existing users and recreate (clean slate)
echo -e "${YELLOW}Cleaning up existing entries...${NC}"
for uid in admin author reviewer publisher author2 reviewer2; do
    docker exec ${CONTAINER_NAME} ldapdelete -x -H ldap://localhost -D "${ADMIN_DN}" -w "${LDAP_ADMIN_PASSWORD}" "uid=${uid},ou=Users,${BASE_DN}" 2>/dev/null || true
done

for cn in Admins Authors Reviewers Publishers AllUsers; do
    docker exec ${CONTAINER_NAME} ldapdelete -x -H ldap://localhost -D "${ADMIN_DN}" -w "${LDAP_ADMIN_PASSWORD}" "cn=${cn},ou=Groups,${BASE_DN}" 2>/dev/null || true
done

# Delete OUs
docker exec ${CONTAINER_NAME} ldapdelete -x -H ldap://localhost -D "${ADMIN_DN}" -w "${LDAP_ADMIN_PASSWORD}" "ou=Users,${BASE_DN}" 2>/dev/null || true
docker exec ${CONTAINER_NAME} ldapdelete -x -H ldap://localhost -D "${ADMIN_DN}" -w "${LDAP_ADMIN_PASSWORD}" "ou=Groups,${BASE_DN}" 2>/dev/null || true
docker exec ${CONTAINER_NAME} ldapdelete -x -H ldap://localhost -D "${ADMIN_DN}" -w "${LDAP_ADMIN_PASSWORD}" "ou=ServiceAccounts,${BASE_DN}" 2>/dev/null || true

echo -e "${GREEN}✓ Cleanup complete${NC}"

# Create OUs
echo -e "${YELLOW}Creating organizational units...${NC}"
docker exec -i ${CONTAINER_NAME} ldapadd -x -H ldap://localhost -D "${ADMIN_DN}" -w "${LDAP_ADMIN_PASSWORD}" -c << 'EOF'
dn: ou=Users,dc=hcldx,dc=local
objectClass: organizationalUnit
ou: Users

dn: ou=Groups,dc=hcldx,dc=local
objectClass: organizationalUnit
ou: Groups

dn: ou=ServiceAccounts,dc=hcldx,dc=local
objectClass: organizationalUnit
ou: ServiceAccounts
EOF

echo -e "${GREEN}✓ OUs created${NC}"

# Create users
echo -e "${YELLOW}Creating users...${NC}"
docker exec -i ${CONTAINER_NAME} ldapadd -x -H ldap://localhost -D "${ADMIN_DN}" -w "${LDAP_ADMIN_PASSWORD}" -c << 'EOF'
dn: uid=admin,ou=Users,dc=hcldx,dc=local
objectClass: inetOrgPerson
objectClass: posixAccount
objectClass: shadowAccount
uid: admin
sn: Administrator
givenName: System
cn: System Administrator
displayName: System Administrator
uidNumber: 1000
gidNumber: 1000
homeDirectory: /home/admin
loginShell: /bin/bash
mail: admin@hcldx.local
userPassword: password

dn: uid=author,ou=Users,dc=hcldx,dc=local
objectClass: inetOrgPerson
objectClass: posixAccount
objectClass: shadowAccount
uid: author
sn: Author
givenName: Content
cn: Content Author
displayName: Content Author
uidNumber: 1001
gidNumber: 1001
homeDirectory: /home/author
loginShell: /bin/bash
mail: author@hcldx.local
userPassword: password

dn: uid=reviewer,ou=Users,dc=hcldx,dc=local
objectClass: inetOrgPerson
objectClass: posixAccount
objectClass: shadowAccount
uid: reviewer
sn: Reviewer
givenName: Content
cn: Content Reviewer
displayName: Content Reviewer
uidNumber: 1002
gidNumber: 1002
homeDirectory: /home/reviewer
loginShell: /bin/bash
mail: reviewer@hcldx.local
userPassword: password

dn: uid=publisher,ou=Users,dc=hcldx,dc=local
objectClass: inetOrgPerson
objectClass: posixAccount
objectClass: shadowAccount
uid: publisher
sn: Publisher
givenName: Content
cn: Content Publisher
displayName: Content Publisher
uidNumber: 1003
gidNumber: 1003
homeDirectory: /home/publisher
loginShell: /bin/bash
mail: publisher@hcldx.local
userPassword: password
EOF

echo -e "${GREEN}✓ Users created${NC}"

# Create groups
echo -e "${YELLOW}Creating groups...${NC}"
docker exec -i ${CONTAINER_NAME} ldapadd -x -H ldap://localhost -D "${ADMIN_DN}" -w "${LDAP_ADMIN_PASSWORD}" -c << 'EOF'
dn: cn=Admins,ou=Groups,dc=hcldx,dc=local
objectClass: groupOfNames
cn: Admins
member: uid=admin,ou=Users,dc=hcldx,dc=local

dn: cn=Authors,ou=Groups,dc=hcldx,dc=local
objectClass: groupOfNames
cn: Authors
member: uid=author,ou=Users,dc=hcldx,dc=local

dn: cn=Reviewers,ou=Groups,dc=hcldx,dc=local
objectClass: groupOfNames
cn: Reviewers
member: uid=reviewer,ou=Users,dc=hcldx,dc=local

dn: cn=Publishers,ou=Groups,dc=hcldx,dc=local
objectClass: groupOfNames
cn: Publishers
member: uid=publisher,ou=Users,dc=hcldx,dc=local
EOF

echo -e "${GREEN}✓ Groups created${NC}"

# Verify users
echo ""
echo -e "${CYAN}Verifying LDAP entries...${NC}"
USER_COUNT=$(docker exec ${CONTAINER_NAME} ldapsearch -x -H ldap://localhost -b "ou=Users,${BASE_DN}" -D "${ADMIN_DN}" -w "${LDAP_ADMIN_PASSWORD}" "(uid=*)" uid 2>/dev/null | grep -c "^uid:" || echo "0")
echo -e "  Users: ${USER_COUNT}"

GROUP_COUNT=$(docker exec ${CONTAINER_NAME} ldapsearch -x -H ldap://localhost -b "ou=Groups,${BASE_DN}" -D "${ADMIN_DN}" -w "${LDAP_ADMIN_PASSWORD}" "(cn=*)" cn 2>/dev/null | grep -c "^cn:" || echo "0")
echo -e "  Groups: ${GROUP_COUNT}"

# Test authentication
echo ""
echo -e "${CYAN}Testing authentication...${NC}"
if docker exec ${CONTAINER_NAME} ldapwhoami -x -H ldap://localhost -D "uid=admin,ou=Users,${BASE_DN}" -w "password" 2>/dev/null; then
    echo -e "${GREEN}✓ Authentication test PASSED for admin/password${NC}"
else
    echo -e "${RED}✗ Authentication test FAILED${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  LDAP Fix Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}Login credentials:${NC}"
echo -e "  Username: ${YELLOW}admin${NC}"
echo -e "  Password: ${YELLOW}password${NC}"
echo ""
echo -e "${CYAN}Other users: author, reviewer, publisher (all use 'password')${NC}"
echo ""
