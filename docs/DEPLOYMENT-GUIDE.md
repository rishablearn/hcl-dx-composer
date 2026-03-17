# HCL DX Composer - Deployment Guide

> Complete guide for deploying the HCL DX Composer application with proper sequencing.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Project Structure](#project-structure)
4. [Deployment Sequence](#deployment-sequence)
5. [Configuration Groups](#configuration-groups)
6. [Step-by-Step Deployment](#step-by-step-deployment)
7. [Verification Checklist](#verification-checklist)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HCL DX Composer Architecture                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐               │
│   │   Frontend   │────▶│   Backend    │────▶│  PostgreSQL  │               │
│   │  (React/Vite)│     │  (Node.js)   │     │   Database   │               │
│   │   Port 3000  │     │   Port 3001  │     │   Port 5432  │               │
│   └──────────────┘     └──────┬───────┘     └──────────────┘               │
│                               │                                              │
│                    ┌──────────┼──────────┐                                  │
│                    │          │          │                                  │
│                    ▼          ▼          ▼                                  │
│            ┌───────────┐ ┌─────────┐ ┌──────────┐                          │
│            │   LDAP    │ │ HCL DX  │ │    AI    │                          │
│            │ (Local or │ │  APIs   │ │ Providers│                          │
│            │  Common)  │ │         │ │          │                          │
│            └───────────┘ └─────────┘ └──────────┘                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Service Dependencies

| Service | Depends On | Startup Order |
|---------|------------|---------------|
| PostgreSQL | - | 1 (First) |
| OpenLDAP (Local mode) | - | 1 (First) |
| Backend | PostgreSQL, LDAP | 2 (Second) |
| Frontend | Backend | 3 (Third) |

---

## Prerequisites

### Required Software

| Software | Minimum Version | Check Command |
|----------|-----------------|---------------|
| Docker | 20.10+ | `docker --version` |
| Docker Compose | 2.0+ | `docker compose version` |
| Git | 2.0+ | `git --version` |

### Optional (for Development)

| Software | Minimum Version | Check Command |
|----------|-----------------|---------------|
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |

### Required Information

Before starting, gather the following based on your deployment type:

#### For All Deployments
- [ ] Server/VM with Docker installed
- [ ] Server hostname (use `hostname` command to find it)
- [ ] Network access to ports 3000, 3001, 5432, 443 (for SSL)

#### For HCL DX Integration
- [ ] HCL DX server hostname and port
- [ ] HCL DX service account credentials (username/password for LtpaToken2 login)
- [ ] WCM Library name
- [ ] WCM REST API path (default: `/wps/mycontenthandler/wcmrest`)
- [ ] CORS enabled for your domain on HCL DX

#### For Common LDAP (Enterprise)
- [ ] LDAP server URL
- [ ] LDAP Base DN
- [ ] Service account DN and password
- [ ] User/Group search bases

#### For AI Features (Optional)
- [ ] API keys for chosen provider(s)

---

## Project Structure

```
hcl-dx-composer/
│
├── 📁 backend/                 # Node.js API Server
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── config/            # Configuration modules
│       ├── controllers/       # API controllers
│       ├── middleware/        # Auth, validation, etc.
│       ├── models/            # Database models
│       ├── routes/            # API routes
│       ├── services/          # Business logic
│       └── index.js           # Entry point
│
├── 📁 frontend/                # React/Vite Application
│   ├── Dockerfile
│   ├── nginx.conf             # Production web server config
│   ├── package.json
│   └── src/
│       ├── components/        # React components
│       ├── pages/             # Page components
│       ├── services/          # API clients
│       └── App.jsx            # Root component
│
├── 📁 db/                      # Database
│   └── init/                  # Initialization scripts
│       └── 01-schema.sql      # Database schema
│
├── 📁 ldap/                    # LDAP Configuration
│   ├── bootstrap/             # LDIF files for Local LDAP
│   │   ├── 01-base.ldif       # Organization structure
│   │   ├── 02-users.ldif      # Pre-configured users
│   │   └── 03-groups.ldif     # Role-based groups
│   └── scripts/               # LDAP management
│       ├── init-ldap.sh       # Initialize LDAP
│       └── manage-ldap.sh     # User/group management
│
├── 📁 scripts/                 # Deployment Scripts
│   ├── setup.sh               # Interactive configuration
│   ├── deploy.sh              # Docker deployment
│   ├── dev.sh                 # Development mode
│   ├── health-check.sh        # Service health check
│   └── backup.sh              # Backup database/files
│
├── 📁 docs/                    # Documentation
│   ├── DEPLOYMENT-GUIDE.md    # This file
│   ├── HCL-DX-INTEGRATION.md  # HCL DX API guide
│   ├── LDAP-CONFIGURATION.md  # LDAP setup guide
│   └── AI-IMAGE-PROVIDERS.md  # AI providers guide
│
├── 📁 uploads/                 # Uploaded files storage
│
├── docker-compose.yml          # Container orchestration
├── .env.example                # Environment template
├── .env                        # Your configuration (created by setup.sh)
└── README.md                   # Project overview
```

---

## Deployment Sequence

### Phase 1: Prerequisites & Setup
```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: PREREQUISITES & SETUP                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1.1: Clone Repository                                     │
│     └─▶ git clone                                               │
│                                                                 │
│  Step 1.2: Run Setup Script                                     │
│     └─▶ ./scripts/setup.sh                                      │
│         ├─▶ Configure Database                                  │
│         ├─▶ Configure LDAP (Local/Common)                       │
│         ├─▶ Configure HCL DX Integration                        │
│         ├─▶ Configure AI Providers (Optional)                   │
│         └─▶ Generate .env file                                  │
│                                                                 │
│  Step 1.3: Review Configuration                                 │
│     └─▶ Verify .env settings                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 2: Build & Deploy
```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: BUILD & DEPLOY                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 2.1: Build & Start Services                               │
│     └─▶ ./scripts/deploy.sh --build                             │
│         │                                                       │
│         ├─▶ [If LDAP_MODE=local] Start OpenLDAP                │
│         │      └─▶ Load bootstrap LDIF files                   │
│         │                                                       │
│         ├─▶ Start PostgreSQL                                    │
│         │      └─▶ Run init/01-schema.sql                      │
│         │                                                       │
│         ├─▶ Build & Start Backend                              │
│         │      └─▶ Wait for DB healthy                         │
│         │                                                       │
│         └─▶ Build & Start Frontend                             │
│                └─▶ Wait for Backend                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 3: Verify & Test
```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: VERIFY & TEST                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 3.1: Check Service Status                                 │
│     └─▶ ./scripts/deploy.sh --status                            │
│                                                                 │
│  Step 3.2: Health Check                                         │
│     └─▶ ./scripts/health-check.sh                               │
│                                                                 │
│  Step 3.3: Test Login                                           │
│     └─▶ Access http://localhost:3000                            │
│         └─▶ Login with configured user                          │
│                                                                 │
│  Step 3.4: Test HCL DX Connection (if configured)              │
│     └─▶ Test content sync in application                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Configuration Groups

### Group 1: Core Infrastructure (Required)

| Component | Description | Configured By |
|-----------|-------------|---------------|
| PostgreSQL | Application database | setup.sh |
| Backend | Node.js API server | setup.sh |
| Frontend | React web application | setup.sh |

### Group 2: Authentication (Choose One)

| Option | Description | Best For |
|--------|-------------|----------|
| **Local LDAP** | Docker OpenLDAP with pre-configured users | Development, Testing, Demos |
| **Common LDAP** | External AD/LDAP server | Production, Enterprise |

### Group 3: HCL DX Integration (Required for Production)

| Component | Description | Required |
|-----------|-------------|----------|
| WCM API | Content management | Yes |
| DAM API | Digital asset management | Yes |
| LTPA2 SSO | Single sign-on | Optional |

### Group 4: AI Image Generation (Optional)

| Provider | Free Tier | Best For |
|----------|-----------|----------|
| Pollinations AI | Unlimited | Development, Testing |
| Cloudflare Workers AI | 10K neurons/day | Production with limits |
| Google Gemini | 60 req/min | High quality |
| OpenAI DALL-E | Pay-per-use | Enterprise quality |
| Stability AI | Pay-per-use | Artistic styles |
| Hugging Face | Limited | Open source models |

---

## Step-by-Step Deployment

### Step 1: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/rishablearn/hcl-dx-composer.git

# Navigate to project directory
cd hcl-dx-composer
```

### Step 2: Run Setup Script

```bash
# Make scripts executable (if needed)
chmod +x scripts/*.sh ldap/scripts/*.sh

# Run interactive setup
./scripts/setup.sh
```

The setup script will guide you through:

1. **Database Configuration**
   - PostgreSQL database name, user, password
   - Secure passwords are auto-generated

2. **LDAP Configuration**
   - Choose: Local OpenLDAP or Common LDAP
   - Local: Pre-configured users ready to use
   - Common: Enter your enterprise LDAP details

3. **HCL DX Configuration**
   - Server hostname, port, and protocol
   - Service account credentials (used for auto LtpaToken2 login)
   - WCM API path (path or full URL; default: `/wps/mycontenthandler/wcmrest`)
   - WCM Library name
   - DAM API is auto-configured from host settings

4. **AI Providers (Optional)**
   - Select provider(s)
   - Enter API keys

### Step 3: Review Configuration

```bash
# View generated configuration
cat .env

# Verify critical settings
grep -E "^(LDAP_MODE|HCL_DX_HOST|POSTGRES_)" .env
```

### Step 4: Deploy the Application

```bash
# Build and start all services
./scripts/deploy.sh --build
```

**What happens:**
1. Docker pulls/builds images
2. OpenLDAP starts (if LDAP_MODE=local)
3. PostgreSQL starts and initializes schema
4. Backend starts and connects to DB/LDAP
5. Frontend starts and serves web app

### Step 5: Verify Deployment

```bash
# Check service status
./scripts/deploy.sh --status

# Run health check
./scripts/health-check.sh

# View logs
./scripts/deploy.sh --logs
```

### Step 6: Access the Application

> **Important:** Use your configured hostname instead of `localhost` for proper SSL and network access.

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend (HTTP) | `http://<hostname>:3000` | Web application |
| Frontend (HTTPS) | `https://<hostname>:443` | Web application (SSL) |
| Backend API | `http://<hostname>:3000/api` | REST API (via nginx proxy) |
| Health Check | `http://<hostname>:3000/health` | Service health |

**Example with hostname:**
```bash
# If your hostname is 'myserver.local':
http://myserver.local:3000      # HTTP
https://myserver.local:443      # HTTPS (SSL mode)
```

### Step 7: Login

**For Local LDAP (default):**
| Username | Password | Role |
|----------|----------|------|
| admin | password | Administrator |
| author | password | Content Author |
| reviewer | password | Content Reviewer |
| publisher | password | Publisher |

**For Common LDAP:**
Use your enterprise Active Directory credentials.

---

## Verification Checklist

### Pre-Deployment

- [ ] Docker is running (`docker info`)
- [ ] Ports 3000, 3001, 5432 are available
- [ ] Git clone successful
- [ ] Scripts are executable

### Post-Deployment

- [ ] All containers are running (`docker ps`)
- [ ] PostgreSQL is healthy
- [ ] Backend health check passes
- [ ] Frontend loads in browser
- [ ] Login works with test user
- [ ] (If configured) HCL DX connection works
- [ ] (If configured) AI image generation works

### Health Check Commands

```bash
# Quick status
./scripts/deploy.sh --status

# Detailed health check
./scripts/health-check.sh

# Check specific container
docker logs hcl-dx-backend
docker logs hcl-dx-postgres

# Test API health
curl http://localhost:3001/api/health
```

---

## Troubleshooting

### Common Issues

#### 1. Container Won't Start

```bash
# Check logs
docker logs <container-name>

# Rebuild
./scripts/deploy.sh --build --recreate
```

#### 2. Database Connection Failed

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check database logs
docker logs hcl-dx-postgres

# Verify credentials in .env
grep POSTGRES .env
```

#### 3. LDAP Authentication Failed

```bash
# For Local LDAP - check container
docker logs hcl-dx-openldap

# Test LDAP connection
ldapsearch -x -H ldap://localhost:389 -D "cn=admin,dc=hcldx,dc=local" -w admin_password -b "dc=hcldx,dc=local"

# Verify LDAP mode
grep LDAP_MODE .env
```

#### 4. Frontend Can't Reach Backend

```bash
# Check CORS and API URL
grep VITE_API_BASE_URL .env

# Check backend is responding
curl http://localhost:3001/api/health
```

#### 5. HCL DX Connection Failed

```bash
# Verify HCL DX settings
grep HCL_DX .env

# Check network connectivity
curl -k https://your-dx-server/wps/portal

# Check backend startup log for resolved URLs
docker-compose logs backend | grep 'HCL DX Service Configuration' -A 10

# Verify LtpaToken2 authentication is working
docker-compose logs backend | grep -i 'ltpa'
```

#### 6. WCM Libraries Not Loading

```bash
# Check the WCM URL being used
docker-compose logs backend | grep 'WCM API'

# Common causes:
# - HCL_DX_WCM_BASE_URL set to full URL (now supported, but verify it's correct)
# - Incorrect WCM path (try /wps/mycontenthandler/wcmrest)
# - 401 Unauthorized (check HCL_DX_USERNAME/HCL_DX_PASSWORD)
```

#### 7. DAM Upload Failing with 401

```bash
# DAM API requires LtpaToken2 cookie authentication
# Verify the backend can obtain an LTPA token:
docker-compose logs backend | grep -i 'LtpaToken2'

# If "Could not obtain LtpaToken2" appears, check:
# - HCL_DX_USERNAME and HCL_DX_PASSWORD are correct
# - The /wps/j_security_check endpoint is accessible
# - Self-signed certs are handled (backend uses rejectUnauthorized: false)
```

### Reset Everything

```bash
# Stop and remove all containers
./scripts/deploy.sh --down

# Remove volumes (WARNING: deletes all data)
docker volume rm hcl-dx-composer_postgres_data
docker volume rm hcl-dx-composer_openldap_data
docker volume rm hcl-dx-composer_openldap_config

# Start fresh
./scripts/setup.sh
./scripts/deploy.sh --build
```

---

## Quick Reference Commands

| Action | Command |
|--------|---------|
| Initial setup | `./scripts/setup.sh` |
| Deploy (first time) | `./scripts/deploy.sh --build` |
| Start services | `./scripts/deploy.sh` |
| Stop services | `./scripts/deploy.sh --stop` |
| Restart services | `./scripts/deploy.sh --restart` |
| View status | `./scripts/deploy.sh --status` |
| View logs | `./scripts/deploy.sh --logs` |
| Health check | `./scripts/health-check.sh` |
| Backup | `./scripts/backup.sh` |
| Development mode | `./scripts/dev.sh` |
| LDAP: List users | `./ldap/scripts/manage-ldap.sh list-users` |
| LDAP: Add user | `./ldap/scripts/manage-ldap.sh add-user <user> <pass> <first> <last>` |

---

## Next Steps

After successful deployment:

1. **Configure Users** - Set up additional users via LDAP management
2. **HCL DX Integration** - Configure content libraries and workflows
3. **AI Features** - Enable AI image generation if needed
4. **Backup Strategy** - Set up regular backups with `backup.sh`
5. **Monitoring** - Configure health checks and alerts

---

## Documentation Links

- [README.md](../README.md) - Project overview
- [HCL-DX-INTEGRATION.md](./HCL-DX-INTEGRATION.md) - HCL DX API integration
- [LDAP-CONFIGURATION.md](./LDAP-CONFIGURATION.md) - LDAP setup details
- [AI-IMAGE-PROVIDERS.md](./AI-IMAGE-PROVIDERS.md) - AI provider configuration

---

*Last updated: March 2026*
