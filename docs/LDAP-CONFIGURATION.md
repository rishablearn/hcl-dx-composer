# LDAP Authentication Configuration Guide

This document provides comprehensive instructions for configuring LDAP authentication in HCL DX Composer. All authentication happens through the API layer.

## Overview

HCL DX Composer supports two LDAP modes for user authentication and workflow management:

| Mode | Description | Best For |
|------|-------------|----------|
| **Local LDAP** | Docker OpenLDAP container (included) | Development, Testing, Demos |
| **Common LDAP** | Shared LDAP with HCL DX (AD/OpenLDAP) | Production, Enterprise |

## API Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HCL DX Composer Application                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐   │
│   │   Frontend   │────▶│  Backend API │────▶│   LDAP Authentication    │   │
│   │   (React)    │     │  (Node.js)   │     │   Service (ldapService)  │   │
│   └──────────────┘     └──────────────┘     └──────────────────────────┘   │
│                                                        │                     │
│                                                        ▼                     │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        LDAP MODE SELECTION                           │   │
│   ├─────────────────────────────┬───────────────────────────────────────┤   │
│   │      LOCAL LDAP             │           COMMON LDAP                  │   │
│   │   (Docker OpenLDAP)         │    (HCL DX / Active Directory)        │   │
│   │                             │                                        │   │
│   │   ldap://openldap:389       │   ldap://your-ldap-server:389         │   │
│   │   dc=hcldx,dc=local         │   DC=company,DC=com                   │   │
│   └─────────────────────────────┴───────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Local LDAP (Docker OpenLDAP)

### Overview

Local LDAP uses a Docker OpenLDAP container that runs alongside your application. This is the **recommended option for development, testing, and demos**.

### Features

- ✅ **No external dependencies** - Everything runs in Docker
- ✅ **Pre-configured users** - Ready-to-use workflow accounts
- ✅ **Pre-configured groups** - Role-based access control setup
- ✅ **Instant setup** - No LDAP server configuration needed
- ✅ **Isolated environment** - Safe for testing

### Configuration

```env
# Local OpenLDAP Mode
LDAP_MODE=local
LDAP_URL=ldap://openldap:389
LDAP_BASE_DN=dc=hcldx,dc=local
LDAP_BIND_DN=cn=admin,dc=hcldx,dc=local
LDAP_BIND_PASSWORD=admin_password
LDAP_USER_SEARCH_BASE=ou=Users,dc=hcldx,dc=local
LDAP_GROUP_SEARCH_BASE=ou=Groups,dc=hcldx,dc=local

# OpenLDAP Docker Settings
LDAP_ADMIN_PASSWORD=admin_password
LDAP_CONFIG_PASSWORD=config_password
LDAP_ORGANISATION=HCL DX Composer
LDAP_DOMAIN=hcldx.local
```

### Pre-Configured Users

| Username | Password | Role | Permissions |
|----------|----------|------|-------------|
| `admin` | `password` | Administrator | Full system access, user management |
| `author` | `password` | Author | Create and edit content |
| `reviewer` | `password` | Reviewer | Review and approve/reject content |
| `publisher` | `password` | Publisher | Publish approved content to HCL DX |

### Pre-Configured Groups

| Group DN | Role Mapping | Description |
|----------|--------------|-------------|
| `cn=Admins,ou=Groups,dc=hcldx,dc=local` | Admin | System administrators |
| `cn=Authors,ou=Groups,dc=hcldx,dc=local` | Author | Content creators |
| `cn=Reviewers,ou=Groups,dc=hcldx,dc=local` | Reviewer | Content approvers |
| `cn=Publishers,ou=Groups,dc=hcldx,dc=local` | Publisher | HCL DX publishers |

### Directory Structure

```
dc=hcldx,dc=local
├── ou=Users
│   ├── uid=admin
│   ├── uid=author
│   ├── uid=reviewer
│   └── uid=publisher
└── ou=Groups
    ├── cn=Admins (members: admin)
    ├── cn=Authors (members: author)
    ├── cn=Reviewers (members: reviewer)
    └── cn=Publishers (members: publisher)
```

### LDIF Bootstrap File

The Local LDAP is initialized with this LDIF structure:

```ldif
# Organization
dn: dc=hcldx,dc=local
objectClass: top
objectClass: dcObject
objectClass: organization
o: HCL DX Composer
dc: hcldx

# Users OU
dn: ou=Users,dc=hcldx,dc=local
objectClass: organizationalUnit
ou: Users

# Groups OU
dn: ou=Groups,dc=hcldx,dc=local
objectClass: organizationalUnit
ou: Groups

# Admin User
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
mail: admin@hcldx.local
userPassword: {SSHA}password_hash

# Author User
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
mail: author@hcldx.local
userPassword: {SSHA}password_hash

# Reviewer User
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
mail: reviewer@hcldx.local
userPassword: {SSHA}password_hash

# Publisher User
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
mail: publisher@hcldx.local
userPassword: {SSHA}password_hash

# Admins Group
dn: cn=Admins,ou=Groups,dc=hcldx,dc=local
objectClass: groupOfNames
cn: Admins
description: System Administrators
member: uid=admin,ou=Users,dc=hcldx,dc=local

# Authors Group
dn: cn=Authors,ou=Groups,dc=hcldx,dc=local
objectClass: groupOfNames
cn: Authors
description: Content Authors
member: uid=author,ou=Users,dc=hcldx,dc=local

# Reviewers Group
dn: cn=Reviewers,ou=Groups,dc=hcldx,dc=local
objectClass: groupOfNames
cn: Reviewers
description: Content Reviewers
member: uid=reviewer,ou=Users,dc=hcldx,dc=local

# Publishers Group
dn: cn=Publishers,ou=Groups,dc=hcldx,dc=local
objectClass: groupOfNames
cn: Publishers
description: Content Publishers
member: uid=publisher,ou=Users,dc=hcldx,dc=local
```

### Starting Local LDAP

```bash
# Start OpenLDAP with the local-ldap profile
docker-compose --profile local-ldap up -d openldap

# Or start all services including OpenLDAP
docker-compose --profile local-ldap up -d
```

### LDAP Management Scripts

The `ldap/scripts/` directory contains utility scripts:

| Script | Description |
|--------|-------------|
| `init-ldap.sh` | Initialize LDAP with bootstrap data |
| `manage-ldap.sh` | Manage users and groups |

#### Initialize LDAP (First Time Setup)

```bash
# After starting OpenLDAP, initialize with users and groups
./ldap/scripts/init-ldap.sh
```

#### Manage Users and Groups

```bash
# List all users
./ldap/scripts/manage-ldap.sh list-users

# List all groups
./ldap/scripts/manage-ldap.sh list-groups

# Add a new user
./ldap/scripts/manage-ldap.sh add-user john password123 John Doe john@example.com

# Add user to a group
./ldap/scripts/manage-ldap.sh add-to-group john Authors

# Test authentication
./ldap/scripts/manage-ldap.sh test-auth john password123

# Change password
./ldap/scripts/manage-ldap.sh change-password john newpassword

# Remove from group
./ldap/scripts/manage-ldap.sh remove-from-group john Authors

# Delete user
./ldap/scripts/manage-ldap.sh delete-user john
```

### Testing Local LDAP

```bash
# Test LDAP connection
ldapsearch -x -H ldap://localhost:389 -D "cn=admin,dc=hcldx,dc=local" -w admin_password -b "dc=hcldx,dc=local"

# List all users
ldapsearch -x -H ldap://localhost:389 -D "cn=admin,dc=hcldx,dc=local" -w admin_password -b "ou=Users,dc=hcldx,dc=local" "(objectClass=inetOrgPerson)"

# List all groups
ldapsearch -x -H ldap://localhost:389 -D "cn=admin,dc=hcldx,dc=local" -w admin_password -b "ou=Groups,dc=hcldx,dc=local" "(objectClass=groupOfNames)"

# Test user authentication
ldapwhoami -x -H ldap://localhost:389 -D "uid=author,ou=Users,dc=hcldx,dc=local" -w password
```

### Adding Custom Users

```bash
# Create LDIF file for new user
cat > new_user.ldif << EOF
dn: uid=newuser,ou=Users,dc=hcldx,dc=local
objectClass: inetOrgPerson
objectClass: posixAccount
objectClass: shadowAccount
uid: newuser
sn: User
givenName: New
cn: New User
displayName: New User
uidNumber: 1004
gidNumber: 1004
homeDirectory: /home/newuser
mail: newuser@hcldx.local
userPassword: password
EOF

# Add user
ldapadd -x -H ldap://localhost:389 -D "cn=admin,dc=hcldx,dc=local" -w admin_password -f new_user.ldif

# Add user to group
cat > add_to_group.ldif << EOF
dn: cn=Authors,ou=Groups,dc=hcldx,dc=local
changetype: modify
add: member
member: uid=newuser,ou=Users,dc=hcldx,dc=local
EOF

ldapmodify -x -H ldap://localhost:389 -D "cn=admin,dc=hcldx,dc=local" -w admin_password -f add_to_group.ldif
```

---

## Common LDAP (HCL DX / Active Directory)

### Overview

Common LDAP connects to your organization's existing LDAP server (Active Directory, OpenLDAP, etc.) that is also used by HCL DX. This is the **recommended option for production environments**.

### Features

- ✅ **Single user directory** - Same users as HCL DX Portal
- ✅ **Enterprise SSO** - Integrate with existing authentication
- ✅ **Centralized management** - Manage users in one place
- ✅ **Existing groups** - Use your organization's group structure

### Configuration for Active Directory

```env
# Common LDAP Mode - Active Directory
LDAP_MODE=common
LDAP_URL=ldap://ad-server.company.com:389
LDAP_BASE_DN=DC=company,DC=com
LDAP_BIND_DN=CN=ServiceAccount,OU=ServiceAccounts,DC=company,DC=com
LDAP_BIND_PASSWORD=your_secure_password
LDAP_USER_SEARCH_BASE=OU=Users,DC=company,DC=com
LDAP_GROUP_SEARCH_BASE=OU=Groups,DC=company,DC=com

# Not used for common LDAP
LDAP_ADMIN_PASSWORD=
LDAP_CONFIG_PASSWORD=
LDAP_ORGANISATION=
LDAP_DOMAIN=
```

### Configuration for OpenLDAP (Enterprise)

```env
# Common LDAP Mode - Enterprise OpenLDAP
LDAP_MODE=common
LDAP_URL=ldap://ldap.company.com:389
LDAP_BASE_DN=dc=company,dc=com
LDAP_BIND_DN=cn=readonly,dc=company,dc=com
LDAP_BIND_PASSWORD=your_secure_password
LDAP_USER_SEARCH_BASE=ou=People,dc=company,dc=com
LDAP_GROUP_SEARCH_BASE=ou=Groups,dc=company,dc=com
```

### LDAPS (Secure LDAP)

```env
# Use LDAPS for encrypted connections
LDAP_URL=ldaps://ad-server.company.com:636
```

### Role Mapping

Map your LDAP groups to application roles in the Admin Configuration page:

| LDAP Group | Application Role |
|------------|------------------|
| `CN=DX-Admins,OU=Groups,DC=company,DC=com` | Admin |
| `CN=DX-Authors,OU=Groups,DC=company,DC=com` | Author |
| `CN=DX-Reviewers,OU=Groups,DC=company,DC=com` | Reviewer |
| `CN=DX-Publishers,OU=Groups,DC=company,DC=com` | Publisher |

### Testing Common LDAP

```bash
# Test Active Directory connection
ldapsearch -x -H ldap://ad-server.company.com:389 \
  -D "CN=ServiceAccount,OU=ServiceAccounts,DC=company,DC=com" \
  -w "your_password" \
  -b "DC=company,DC=com" \
  "(sAMAccountName=testuser)"

# Test OpenLDAP connection
ldapsearch -x -H ldap://ldap.company.com:389 \
  -D "cn=readonly,dc=company,dc=com" \
  -w "your_password" \
  -b "dc=company,dc=com" \
  "(uid=testuser)"
```

---

## Workflow Authentication Flow

### Login Process (API)

```
1. User submits credentials via frontend
   POST /api/auth/login { username, password }
   
2. Backend validates against LDAP
   ldapService.authenticate(username, password)
   
3. Backend retrieves user groups
   ldapService.getUserGroups(userDN)
   
4. Backend maps groups to roles
   roleService.mapGroupsToRoles(groups)
   
5. JWT token generated and returned
   { token, user: { username, roles, groups } }
```

### Workflow Actions

| Action | Required Role | LDAP Group (Local) | LDAP Group (Common Example) |
|--------|---------------|--------------------|-----------------------------|
| Create Content | Author | cn=Authors | CN=DX-Authors |
| Review Content | Reviewer | cn=Reviewers | CN=DX-Reviewers |
| Approve Content | Reviewer | cn=Reviewers | CN=DX-Reviewers |
| Reject Content | Reviewer | cn=Reviewers | CN=DX-Reviewers |
| Publish to DX | Publisher | cn=Publishers | CN=DX-Publishers |
| Admin Settings | Admin | cn=Admins | CN=DX-Admins |

---

## Troubleshooting

### Local LDAP Issues

| Issue | Solution |
|-------|----------|
| Container not starting | Check `docker logs hcldx-openldap` |
| Cannot connect | Verify port 389 is not in use |
| Authentication fails | Verify password hash in LDIF |
| Users not found | Check LDAP_USER_SEARCH_BASE setting |

### Common LDAP Issues

| Issue | Solution |
|-------|----------|
| Connection refused | Verify LDAP server is accessible |
| Bind failed | Check LDAP_BIND_DN and password |
| Users not found | Verify LDAP_USER_SEARCH_BASE |
| Groups not found | Verify LDAP_GROUP_SEARCH_BASE |
| SSL/TLS errors | Use LDAPS URL or configure certificates |

### Debug Commands

```bash
# Check LDAP connectivity
nc -zv ldap-server 389

# Test with ldapsearch (verbose)
ldapsearch -x -H ldap://server:389 -D "bind_dn" -w "password" -b "base_dn" -d 1

# Check Docker network
docker network inspect hcldx-network

# View OpenLDAP logs
docker logs -f hcldx-openldap
```

---

## Security Best Practices

1. **Use LDAPS** in production for encrypted connections
2. **Service account** should have minimal read-only permissions
3. **Rotate passwords** regularly for service accounts
4. **Network segmentation** - Restrict LDAP access to application servers
5. **Monitor** LDAP authentication failures for security threats

---

## Quick Reference

### Local LDAP Quick Start

```bash
# 1. Run setup
./scripts/setup.sh
# Select: LDAP Mode = Local OpenLDAP

# 2. Deploy
./scripts/deploy.sh --build

# 3. Login with pre-configured users
# admin/password, author/password, reviewer/password, publisher/password
```

### Common LDAP Quick Start

```bash
# 1. Run setup
./scripts/setup.sh
# Select: LDAP Mode = Common LDAP
# Enter your LDAP server details

# 2. Configure role mappings in Admin panel

# 3. Deploy
./scripts/deploy.sh --build
```
