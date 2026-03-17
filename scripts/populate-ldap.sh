#!/bin/bash
#===============================================================================
# HCL DX Composer - LDAP User Population Script
#===============================================================================
# This script populates the Local OpenLDAP with users and groups
# Run after starting the OpenLDAP container
#
# Usage: ./scripts/populate-ldap.sh
#===============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration - read from .env or use defaults
if [ -f .env ]; then
    source .env 2>/dev/null || true
fi

LDAP_ADMIN_PASSWORD="${LDAP_ADMIN_PASSWORD:-admin_password}"
CONTAINER_NAME="${LDAP_CONTAINER_NAME:-hcl-dx-openldap}"

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  HCL DX Composer - LDAP User Population${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${RED}Error: LDAP container '${CONTAINER_NAME}' is not running${NC}"
    exit 1
fi

# Wait for LDAP to be ready
echo -e "${YELLOW}Waiting for LDAP server to be ready...${NC}"
for i in {1..30}; do
    if docker exec ${CONTAINER_NAME} ldapsearch -x -H ldap://localhost -b "dc=hcldx,dc=local" -D "cn=admin,dc=hcldx,dc=local" -w "${LDAP_ADMIN_PASSWORD}" "(objectClass=*)" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ LDAP server is ready${NC}"
        break
    fi
    echo -n "."
    sleep 2
done
echo ""

# Check if Users OU exists
echo -e "${CYAN}Checking if organizational units exist...${NC}"
OU_EXISTS=$(docker exec ${CONTAINER_NAME} ldapsearch -x -H ldap://localhost -b "ou=Users,dc=hcldx,dc=local" -D "cn=admin,dc=hcldx,dc=local" -w "${LDAP_ADMIN_PASSWORD}" "(objectClass=*)" 2>/dev/null | grep -c "dn:" || echo "0")

if [ "$OU_EXISTS" -eq "0" ]; then
    echo -e "${YELLOW}Creating organizational units...${NC}"
    
    # Create OUs one at a time to handle errors better
    docker exec ${CONTAINER_NAME} ldapadd -x -H ldap://localhost -D "cn=admin,dc=hcldx,dc=local" -w "${LDAP_ADMIN_PASSWORD}" -c << 'LDIF'
dn: ou=Users,dc=hcldx,dc=local
objectClass: organizationalUnit
ou: Users
description: HCL DX Composer Users

dn: ou=Groups,dc=hcldx,dc=local
objectClass: organizationalUnit
ou: Groups
description: HCL DX Composer Groups

dn: ou=ServiceAccounts,dc=hcldx,dc=local
objectClass: organizationalUnit
ou: ServiceAccounts
description: Service Accounts for API Integration
LDIF
    
    echo -e "${GREEN}✓ Organizational units created${NC}"
else
    echo -e "${GREEN}✓ Organizational units already exist${NC}"
fi

# Check if users exist
echo -e "${CYAN}Checking if users exist...${NC}"
USER_COUNT=$(docker exec ${CONTAINER_NAME} ldapsearch -x -H ldap://localhost -b "ou=Users,dc=hcldx,dc=local" -D "cn=admin,dc=hcldx,dc=local" -w "${LDAP_ADMIN_PASSWORD}" "(uid=*)" 2>/dev/null | grep -c "^dn:" || echo "0")

if [ "$USER_COUNT" -eq "0" ]; then
    echo -e "${YELLOW}Creating users...${NC}"
    
    docker exec ${CONTAINER_NAME} ldapadd -x -H ldap://localhost -D "cn=admin,dc=hcldx,dc=local" -w "${LDAP_ADMIN_PASSWORD}" -c << 'LDIF'
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
description: System Administrator - Full access to all features

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
description: Content Author - Create and edit content

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
description: Content Reviewer - Review and approve content

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
description: Content Publisher - Publish to HCL DX

dn: uid=author2,ou=Users,dc=hcldx,dc=local
objectClass: inetOrgPerson
objectClass: posixAccount
objectClass: shadowAccount
uid: author2
sn: Author2
givenName: Secondary
cn: Secondary Author
displayName: Secondary Author
uidNumber: 1004
gidNumber: 1001
homeDirectory: /home/author2
loginShell: /bin/bash
mail: author2@hcldx.local
userPassword: password
description: Secondary Author for testing

dn: uid=reviewer2,ou=Users,dc=hcldx,dc=local
objectClass: inetOrgPerson
objectClass: posixAccount
objectClass: shadowAccount
uid: reviewer2
sn: Reviewer2
givenName: Secondary
cn: Secondary Reviewer
displayName: Secondary Reviewer
uidNumber: 1005
gidNumber: 1002
homeDirectory: /home/reviewer2
loginShell: /bin/bash
mail: reviewer2@hcldx.local
userPassword: password
description: Secondary Reviewer for testing
LDIF
    
    echo -e "${GREEN}✓ Users created${NC}"
else
    echo -e "${GREEN}✓ Users already exist (${USER_COUNT} found)${NC}"
fi

# Check if groups exist
echo -e "${CYAN}Checking if groups exist...${NC}"
GROUP_COUNT=$(docker exec ${CONTAINER_NAME} ldapsearch -x -H ldap://localhost -b "ou=Groups,dc=hcldx,dc=local" -D "cn=admin,dc=hcldx,dc=local" -w "${LDAP_ADMIN_PASSWORD}" "(cn=*)" 2>/dev/null | grep -c "^dn:" || echo "0")

if [ "$GROUP_COUNT" -eq "0" ]; then
    echo -e "${YELLOW}Creating groups...${NC}"
    
    docker exec ${CONTAINER_NAME} ldapadd -x -H ldap://localhost -D "cn=admin,dc=hcldx,dc=local" -w "${LDAP_ADMIN_PASSWORD}" -c << 'LDIF'
dn: cn=Admins,ou=Groups,dc=hcldx,dc=local
objectClass: groupOfNames
cn: Admins
description: System Administrators
member: uid=admin,ou=Users,dc=hcldx,dc=local

dn: cn=Authors,ou=Groups,dc=hcldx,dc=local
objectClass: groupOfNames
cn: Authors
description: Content Authors
member: uid=author,ou=Users,dc=hcldx,dc=local
member: uid=author2,ou=Users,dc=hcldx,dc=local

dn: cn=Reviewers,ou=Groups,dc=hcldx,dc=local
objectClass: groupOfNames
cn: Reviewers
description: Content Reviewers
member: uid=reviewer,ou=Users,dc=hcldx,dc=local
member: uid=reviewer2,ou=Users,dc=hcldx,dc=local

dn: cn=Publishers,ou=Groups,dc=hcldx,dc=local
objectClass: groupOfNames
cn: Publishers
description: Content Publishers
member: uid=publisher,ou=Users,dc=hcldx,dc=local

dn: cn=AllUsers,ou=Groups,dc=hcldx,dc=local
objectClass: groupOfNames
cn: AllUsers
description: All Users
member: uid=admin,ou=Users,dc=hcldx,dc=local
member: uid=author,ou=Users,dc=hcldx,dc=local
member: uid=author2,ou=Users,dc=hcldx,dc=local
member: uid=reviewer,ou=Users,dc=hcldx,dc=local
member: uid=reviewer2,ou=Users,dc=hcldx,dc=local
member: uid=publisher,ou=Users,dc=hcldx,dc=local
LDIF
    
    echo -e "${GREEN}✓ Groups created${NC}"
else
    echo -e "${GREEN}✓ Groups already exist (${GROUP_COUNT} found)${NC}"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  LDAP Population Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}Users (password: 'password'):${NC}"
echo -e "  • ${YELLOW}admin${NC}     - System Administrator"
echo -e "  • ${YELLOW}author${NC}    - Content Author"
echo -e "  • ${YELLOW}author2${NC}   - Secondary Author"
echo -e "  • ${YELLOW}reviewer${NC}  - Content Reviewer"
echo -e "  • ${YELLOW}reviewer2${NC} - Secondary Reviewer"
echo -e "  • ${YELLOW}publisher${NC} - Content Publisher"
echo ""
