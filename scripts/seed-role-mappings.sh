#!/bin/bash
#===============================================================================
# HCL DX Composer - Seed Role Mappings
#===============================================================================
# Seeds the database with default role mappings for local LDAP groups
# Run this after setting up LDAP to enable full application functionality
#===============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

DB_CONTAINER="${DB_CONTAINER:-hcl-dx-postgres}"
DB_NAME="${DB_NAME:-hcl_dx_staging}"
DB_USER="${DB_USER:-hcldx}"

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  HCL DX Composer - Seed Role Mappings${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if database container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    echo -e "${RED}Error: Database container '${DB_CONTAINER}' is not running${NC}"
    echo -e "${YELLOW}Start it with: docker compose up -d postgres${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Database container is running${NC}"

# Seed role mappings
echo -e "${YELLOW}Seeding role mappings...${NC}"

docker exec -i ${DB_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} << 'EOF'
-- Admin group -> wpsadmin (full access)
INSERT INTO role_mappings (ldap_group_dn, ldap_group_name, app_role) VALUES
('cn=Admins,ou=Groups,dc=hcldx,dc=local', 'Admins', 'wpsadmin')
ON CONFLICT (ldap_group_dn, app_role) DO NOTHING;

-- Authors group -> dxcontentauthors (can create/upload content)
INSERT INTO role_mappings (ldap_group_dn, ldap_group_name, app_role) VALUES
('cn=Authors,ou=Groups,dc=hcldx,dc=local', 'Authors', 'dxcontentauthors')
ON CONFLICT (ldap_group_dn, app_role) DO NOTHING;

-- Reviewers group -> dxcontentapprovers (can approve/reject content)
INSERT INTO role_mappings (ldap_group_dn, ldap_group_name, app_role) VALUES
('cn=Reviewers,ou=Groups,dc=hcldx,dc=local', 'Reviewers', 'dxcontentapprovers')
ON CONFLICT (ldap_group_dn, app_role) DO NOTHING;

-- Publishers group -> dxcontentauthors (can publish approved content)
INSERT INTO role_mappings (ldap_group_dn, ldap_group_name, app_role) VALUES
('cn=Publishers,ou=Groups,dc=hcldx,dc=local', 'Publishers', 'dxcontentauthors')
ON CONFLICT (ldap_group_dn, app_role) DO NOTHING;

-- AllUsers group -> dxcontentauthors (basic content creation)
INSERT INTO role_mappings (ldap_group_dn, ldap_group_name, app_role) VALUES
('cn=AllUsers,ou=Groups,dc=hcldx,dc=local', 'AllUsers', 'dxcontentauthors')
ON CONFLICT (ldap_group_dn, app_role) DO NOTHING;

SELECT 'Role mappings seeded successfully!' as status;
EOF

echo -e "${GREEN}✓ Role mappings seeded${NC}"

# Verify mappings
echo ""
echo -e "${YELLOW}Current role mappings:${NC}"
docker exec -i ${DB_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -c "SELECT ldap_group_name, app_role FROM role_mappings ORDER BY app_role;"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Role Mappings Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Users now have access to:"
echo -e "  ${CYAN}admin${NC}    → Full access (Settings, all features)"
echo -e "  ${CYAN}author${NC}   → Upload assets, create content"
echo -e "  ${CYAN}reviewer${NC} → Approve/reject content"
echo -e "  ${CYAN}publisher${NC}→ Publish content"
echo ""
echo -e "${YELLOW}If users are still logged in, they need to logout and login again.${NC}"
