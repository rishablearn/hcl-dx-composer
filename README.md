# HCL DX Composer - DAM Workflow & WCM Headless Portal

A modern, whitelabeled React application that acts as a headless composer and approval portal, deeply integrated with HCL Digital Experience (DX) Web Content Manager (WCM) and Digital Asset Management (DAM) APIs.

**Current Theme**: Bharat Petroleum

## Key Features

- **DAM Workflow Engine** - Upload, stage, approve, and publish digital assets
- **WCM Headless Composer** - Dynamic form generation from authoring templates
- **Microsite** - Public-facing portal for viewing published content
- **Multilingual Support** - Full i18n for English, Hindi (हिंदी), and Marathi (मराठी)
- **HCL DX Integration** - Seamless sync with WCM and DAM APIs
- **LDAP/SSO Authentication** - Active Directory + LTPA2 token support

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Docker Compose                          │
├─────────────────┬─────────────────────┬─────────────────────────┤
│    Frontend     │      Backend        │       Database          │
│   React/Vite    │    Node/Express     │      PostgreSQL         │
│   Port: 3000    │    Port: 3001       │      Port: 5432         │
├─────────────────┴─────────────────────┴─────────────────────────┤
│                    External Integrations                         │
├─────────────────┬─────────────────────┬─────────────────────────┤
│  LDAP/Active    │    HCL DX DAM       │     HCL DX WCM          │
│   Directory     │      API            │       API               │
└─────────────────┴─────────────────────┴─────────────────────────┘
```

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS + Lucide Icons + React Router
- **Backend**: Node.js + Express + PostgreSQL + LDAP
- **Database**: PostgreSQL 15 (staging and workflow state)
- **Deployment**: Docker + Docker Compose

## Features

### Feature Module 1: DAM Workflow Engine

1. **System Configuration**: Admin settings page for LDAP group to role mapping
2. **Author Staging Area**: 
   - Upload single or multiple images
   - Images saved in PostgreSQL staging database
   - Thumbnail generation for images
3. **Approval Flow**:
   - Visual workflow stages (Draft → Pending Approval → Approved → Published)
   - Approvers can review and approve/reject assets
4. **HCL DX Sync**:
   - Triggers HCL DX DAM API on approval
   - Creates DAM Collections with date/month tagging
   - Sets Access Control (Administrator: wpsadmin, User: Anonymous Portal User)

### Feature Module 2: WCM Headless Composer

1. **Library & Template Selection**:
   - Fetch and select HCL WCM Libraries
   - Select Authoring Templates
2. **Dynamic Form Generation**:
   - Auto-render forms based on Authoring Template elements
   - Support for text, rich text, images, links, dates, etc.
3. **Workflow Visibility**:
   - Display associated workflows
   - Visual stepper/tracker for workflow stages
4. **Auto-Publish & Preview**:
   - Automatic publishing on final approval
   - Headless preview within the application

### Feature Module 3: Microsite

1. **Published Content Portal**:
   - Browse all published WCM content and DAM assets
   - Filter by language and content type
2. **HCL DX Integration**:
   - Fetch live content directly from HCL DX APIs
   - Headless rendering support
3. **Content Details**:
   - Full article view with schema.org markup
   - Related content suggestions
   - Social sharing capabilities

### Feature Module 4: AI Creative Studio

Generate stunning visuals using AI and seamlessly integrate them into the Digital Asset Workflow.

1. **AI Image Generation**:
   - OpenAI DALL-E 3 integration
   - Stability AI SDXL support
   - Multiple style presets (Corporate, Marketing, Social Media, Minimal, Energetic)
2. **Smart Prompt Enhancement**:
   - One-click prompt optimization
   - Brand-aware suggestions (Bharat Petroleum colors & style)
3. **DAM Workflow Integration**:
   - Auto-stage generated images for approval
   - Assign to collections
   - Full workflow tracking
4. **Generation History**:
   - Track all AI generations
   - Reuse successful prompts

### Feature Module 5: Multilingual Support (i18n)

| Language | Code | Native Name | Script |
|----------|------|-------------|--------|
| English | `en` | English | Latin |
| Hindi | `hi` | हिंदी | Devanagari |
| Marathi | `mr` | मराठी | Devanagari |

**W3C Compliance Features**:
- BCP 47 language tags
- HTML `lang` attribute on content
- `Accept-Language` header support
- Unicode UTF-8 encoding
- Locale-aware date/number formatting
- RTL-ready architecture

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)

### 1. Initial Setup

```bash
cd hcl-dx-composer

# Run the setup script (creates .env with secure defaults)
./scripts/setup.sh
```

### 2. Deploy with Scripts

```bash
# Deploy to Docker (recommended)
./scripts/deploy.sh --build

# Or for local development
./scripts/dev.sh --install
```

### Manual Setup (Alternative)

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 2. Configure Environment Variables

Edit `.env` with your settings:

```env
# Database
POSTGRES_DB=hcl_dx_staging
POSTGRES_USER=hcldx
POSTGRES_PASSWORD=your_secure_password

# LDAP/Active Directory
LDAP_URL=ldap://your-ad-server:389
LDAP_BASE_DN=DC=domain,DC=com
LDAP_BIND_DN=CN=ServiceAccount,OU=ServiceAccounts,DC=domain,DC=com
LDAP_BIND_PASSWORD=your_ldap_password

# HCL DX
HCL_DX_HOST=your-dx-server.domain.com
HCL_DX_PORT=443
HCL_DX_PROTOCOL=https
HCL_DX_API_KEY=your_api_key
HCL_DX_DAM_BASE_URL=https://your-dx-server/dx/api/dam/v1
HCL_DX_WCM_BASE_URL=https://your-dx-server/wps/mycontenthandler/wcmrest

# JWT Secret (generate a secure random string)
JWT_SECRET=your_jwt_secret_min_32_characters
SESSION_SECRET=your_session_secret_min_32_characters

# AI Image Generation (Optional)
OPENAI_API_KEY=sk-your-openai-api-key
STABILITY_API_KEY=sk-your-stability-api-key
AI_IMAGE_PROVIDER=openai
```

### 3. Start with Docker Compose

```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### 4. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001/api
- **Health Check**: http://localhost:3001/api/health

## Deployment Scripts

The `scripts/` folder contains helper scripts for setup and deployment:

| Script | Description |
|--------|-------------|
| `setup.sh` | Initial setup - creates `.env` with secure defaults |
| `deploy.sh` | Docker deployment with various options |
| `dev.sh` | Local development mode |
| `backup.sh` | Backup database and uploads |
| `health-check.sh` | Check health of all services |

### Deploy Script Options

```bash
./scripts/deploy.sh [OPTIONS]

Options:
  --build, -b       Build images before starting
  --foreground, -f  Run in foreground (attached)
  --recreate, -r    Force recreate containers
  --stop, -s        Stop running containers
  --down, -d        Stop and remove containers
  --restart         Restart all services
  --logs, -l        Show container logs
  --status          Show container status
```

### Development Script Options

```bash
./scripts/dev.sh [OPTIONS]

Options:
  --backend, -b    Run only backend
  --frontend, -f   Run only frontend
  --db-only        Run only database
  --install, -i    Install dependencies first
```

## Development Setup

### Backend Development

```bash
cd backend
npm install
npm run dev
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

## Project Structure

```
hcl-dx-composer/
├── docker-compose.yml          # Docker orchestration
├── .env.example                # Environment template
├── README.md
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js            # Express server entry
│       ├── config/
│       │   ├── database.js     # PostgreSQL connection
│       │   └── logger.js       # Winston logger
│       ├── middleware/
│       │   ├── auth.js         # JWT & LTPA2 auth
│       │   └── upload.js       # Multer file upload
│       ├── routes/
│       │   ├── auth.js         # Authentication routes
│       │   ├── dam.js          # DAM workflow routes
│       │   ├── wcm.js          # WCM composer routes
│       │   ├── ai.js           # AI image generation routes
│       │   ├── microsite.js    # Public microsite routes
│       │   ├── config.js       # System configuration
│       │   └── dxProxy.js      # HCL DX API proxy
│       └── services/
│           ├── ldapService.js  # LDAP/AD authentication
│           ├── ltpaService.js  # LTPA2 SSO validation
│           ├── roleService.js  # Role mapping service
│           ├── aiService.js    # AI image generation service
│           └── dxService.js    # HCL DX API client
│
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf              # Production nginx config
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js      # Bharat Petroleum theme
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css           # Tailwind + custom styles
│       ├── components/
│       │   ├── Layout.jsx
│       │   ├── LoadingSpinner.jsx
│       │   └── WorkflowStepper.jsx
│       ├── context/
│       │   └── AuthContext.jsx
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Dashboard.jsx
│       │   ├── DAMWorkflow.jsx
│       │   ├── DAMUpload.jsx
│       │   ├── DAMApprovals.jsx
│       │   ├── WCMContentList.jsx
│       │   ├── WCMComposer.jsx
│       │   ├── WCMApprovals.jsx
│       │   ├── Microsite.jsx
│       │   ├── MicrositeDetail.jsx
│       │   └── Settings.jsx
│       ├── i18n/               # Internationalization
│       │   ├── index.js
│       │   └── locales/
│       │       ├── en.json     # English
│       │       ├── hi.json     # Hindi (हिंदी)
│       │       └── mr.json     # Marathi (मराठी)
│       └── services/
│           └── api.js          # Axios API client
│
├── db/
│   └── init/
│       └── 01-schema.sql       # Database schema
│
└── docs/
    └── HCL-DX-INTEGRATION.md   # HCL DX API integration guide
```

## Theme Configuration (Bharat Petroleum)

The application uses Tailwind CSS with a custom Bharat Petroleum theme:

| Color | Hex | Usage |
|-------|-----|-------|
| Primary (Golden Yellow) | `#FFE000` | Primary buttons, highlights, active states |
| Secondary (Blue Lochmara) | `#007BC9` | Secondary buttons, links, accents |
| Dark Navy (Firefly) | `#102439` | Headers, sidebars, typography |
| Neutral White | `#FFFFFF` | Content cards |
| Light Gray | `#F3F4F6` | App backgrounds |

## Role-Based Access Control

| Role | Permissions |
|------|-------------|
| `dxcontentauthors` | Upload assets, create content, submit for approval |
| `dxcontentapprovers` | Review, approve/reject, publish to HCL DX |
| `wpsadmin` | Full admin access, system configuration |

## API Endpoints

### Authentication
- `POST /api/auth/login` - LDAP authentication
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/sso/validate` - Validate LTPA2 token

### DAM Workflow
- `GET /api/dam/assets` - List staged assets
- `POST /api/dam/assets/upload` - Upload single asset
- `POST /api/dam/assets/upload-multiple` - Upload multiple assets
- `POST /api/dam/assets/:id/submit` - Submit for approval
- `POST /api/dam/assets/:id/approve` - Approve asset
- `POST /api/dam/assets/:id/reject` - Reject asset
- `POST /api/dam/assets/:id/publish` - Publish to HCL DX

### WCM Composer
- `GET /api/wcm/libraries` - List WCM libraries
- `GET /api/wcm/libraries/:id/authoring-templates` - Get authoring templates
- `GET /api/wcm/authoring-templates/:id` - Get template details
- `POST /api/wcm/content` - Create content
- `POST /api/wcm/content/:id/submit` - Submit for approval
- `POST /api/wcm/content/:id/publish` - Publish to HCL DX

### Configuration (Admin)
- `GET /api/config/role-mappings` - Get role mappings
- `POST /api/config/role-mappings` - Create role mapping
- `DELETE /api/config/role-mappings/:id` - Delete mapping
- `GET /api/config/ldap-groups` - Search LDAP groups

### Microsite (Public)
- `GET /api/microsite/content` - Get published WCM content
- `GET /api/microsite/content/:id` - Get content with translations
- `GET /api/microsite/assets` - Get published DAM assets
- `GET /api/microsite/dx/content` - Fetch live content from HCL DX
- `GET /api/microsite/dx/render/:id` - Headless render from HCL DX
- `GET /api/microsite/languages` - Get supported languages

## Documentation

- **[HCL DX Integration Guide](docs/HCL-DX-INTEGRATION.md)** - Comprehensive guide for HCL DX API integration

## HCL DX API References

- [HCL WCM REST API](https://support.hcl-software.com/csm?id=kb_article&sysparm_article=KB0074521)
- [HCL DX Experience API](https://github.com/HCL-TECH-SOFTWARE/experience-api-documentation)
- [HCL DX API Access Docs](https://help.hcl-software.com/digital-experience/9.5/CF233/get_started/product_overview/api_access/)

## Security Considerations

1. **LDAP Authentication**: All users authenticate via Active Directory
2. **JWT Tokens**: Stateless session management with 24-hour expiry
3. **LTPA2 SSO**: Optional SSO with HCL DX Portal
4. **Role-Based Access**: Granular permissions based on LDAP group membership
5. **API Proxy**: All HCL DX API calls proxied through backend for security

## Production Deployment

1. Update `.env` with production values
2. Set `NODE_ENV=production`
3. Use strong JWT and session secrets
4. Configure HTTPS (via reverse proxy)
5. Set up proper backup for PostgreSQL data volume

```bash
# Production build and deploy
docker-compose -f docker-compose.yml up -d --build
```

## Troubleshooting

### Database Connection Issues
```bash
docker-compose logs db
docker-compose exec db psql -U hcldx -d hcl_dx_staging
```

### Backend Logs
```bash
docker-compose logs backend -f
```

### Reset Database
```bash
docker-compose down -v
docker-compose up -d
```

## License

Proprietary - Bharat Petroleum Corporation Limited

---

Built with ❤️ for HCL Digital Experience
