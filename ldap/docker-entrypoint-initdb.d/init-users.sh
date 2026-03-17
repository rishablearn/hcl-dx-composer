#!/bin/bash
# Wait for LDAP to be ready
sleep 5

# Check if users already exist
USER_EXISTS=$(ldapsearch -x -H ldap://localhost -b "ou=Users,dc=hcldx,dc=local" -D "cn=admin,dc=hcldx,dc=local" -w "${LDAP_ADMIN_PASSWORD:-admin_password}" "(uid=admin)" 2>/dev/null | grep -c "dn:")

if [ "$USER_EXISTS" -eq "0" ]; then
    echo "Loading LDAP bootstrap data..."
    
    # Load base structure
    ldapadd -x -H ldap://localhost -D "cn=admin,dc=hcldx,dc=local" -w "${LDAP_ADMIN_PASSWORD:-admin_password}" -f /ldif-custom/01-base.ldif -c 2>/dev/null || true
    
    # Load users
    ldapadd -x -H ldap://localhost -D "cn=admin,dc=hcldx,dc=local" -w "${LDAP_ADMIN_PASSWORD:-admin_password}" -f /ldif-custom/02-users.ldif -c 2>/dev/null || true
    
    # Load groups
    ldapadd -x -H ldap://localhost -D "cn=admin,dc=hcldx,dc=local" -w "${LDAP_ADMIN_PASSWORD:-admin_password}" -f /ldif-custom/03-groups.ldif -c 2>/dev/null || true
    
    echo "LDAP bootstrap complete"
else
    echo "LDAP users already exist"
fi
