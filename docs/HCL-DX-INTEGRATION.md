# HCL Digital Experience - Pure API Integration Guide

> **API Version Support**: This application supports both the modern Ring API (v2) and legacy wcmrest API (v1).
> Set `HCL_DX_API_VERSION=v2` in `.env` for optimal performance with JSON responses.

This document provides comprehensive guidance for integrating HCL DX Composer with HCL Digital Experience (DX) using a **100% API-based approach**. All interactions with WCM (Web Content Manager) and DAM (Digital Asset Management) are performed through REST APIs - no direct server access required.

## Table of Contents

1. [Overview](#overview)
2. [API-Only Architecture](#api-only-architecture)
3. [Prerequisites](#prerequisites)
4. [API Authentication](#api-authentication)
5. [WCM REST API Integration](#wcm-rest-api-integration)
6. [DAM API Integration](#dam-api-integration)
7. [Multilingual Content Support](#multilingual-content-support)
8. [Workflow Integration](#workflow-integration)
9. [Access Control Configuration](#access-control-configuration)
10. [Complete API Reference](#complete-api-reference)
11. [Troubleshooting](#troubleshooting)

---

## Overview

HCL DX Composer operates **entirely through REST APIs** - there is no need for:
- Direct server access or SSH
- File system access to HCL DX server
- WebSphere console access (except for initial API enablement)
- Direct database connections to HCL DX

### What You Can Do via API

| Feature | API Used | Description |
|---------|----------|-------------|
| **Content Creation** | WCM REST API | Create, edit, delete content items |
| **Template Management** | WCM REST API | List and use Authoring Templates |
| **Asset Upload** | DAM API | Upload images, videos, documents |
| **Asset Management** | DAM API | Organize assets in collections |
| **Publishing** | WCM/DAM API | Publish content and assets |
| **Workflow** | WCM REST API | Submit, approve, reject content |
| **User Auth** | LDAP/LTPA2 | Authenticate against Active Directory |

### Key Benefits of API-Only Approach

- **No Server Dependencies**: Deploy anywhere with network access to HCL DX APIs
- **Cloud-Ready**: Run in Docker, Kubernetes, or any cloud platform
- **Secure**: Only HTTPS API calls, no server credentials needed
- **Scalable**: Horizontal scaling without server modifications
- **Portable**: Same codebase works with any HCL DX instance

---

## API-Only Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HCL DX Composer (API Client)                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │     React       │  │    Express      │  │       PostgreSQL            │ │
│  │    Frontend     │──│    Backend      │──│    Local Staging DB         │ │
│  │                 │  │   (API Client)  │  │  (Draft/Approval Queue)     │ │
│  └─────────────────┘  └────────┬────────┘  └─────────────────────────────┘ │
└────────────────────────────────┼────────────────────────────────────────────┘
                                 │
                                 │ HTTPS REST API Calls
                                 │ (No server access required)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        HCL Digital Experience Server                         │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         REST API Layer                                   ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ ││
│  │  │   WCM REST API  │  │    DAM API      │  │     Portal REST API     │ ││
│  │  │  /wcmrest/*     │  │  /dx/api/dam/*  │  │    /wps/portal/*        │ ││
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                    HCL DX Internal Components                            ││
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌─────────────────┐   ││
│  │  │    WCM     │  │    DAM     │  │  Workflow  │  │  LDAP/Security  │   ││
│  │  │  Library   │  │ Repository │  │   Engine   │  │                 │   ││
│  │  └────────────┘  └────────────┘  └────────────┘  └─────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

### API Communication Flow

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   User Action    │────▶│  Composer API    │────▶│   HCL DX API     │
│  (Browser UI)    │     │   (Backend)      │     │  (WCM/DAM)       │
└──────────────────┘     └──────────────────┘     └──────────────────┘
         │                        │                        │
         │  1. Create Content     │                        │
         │─────────────────────▶ │                        │
         │                        │  2. POST /wcmrest/     │
         │                        │──────────────────────▶│
         │                        │                        │
         │                        │  3. Content Created    │
         │                        │◀──────────────────────│
         │  4. Success Response   │                        │
         │◀─────────────────────  │                        │
```

---

## Prerequisites

### What You Need From Your HCL DX Administrator

Since this application uses **API-only integration**, you need the following from your HCL DX administrator:

| Item | Description | Example |
|------|-------------|---------|
| **API Base URL** | HCL DX server hostname | `https://dx.company.com` |
| **Service Account** | Username/password for API calls | `wcmadmin` / `password` |
| **WCM Library Name** | Target library for content | `Web Content` |
| **DAM Access** | Confirmation DAM API is enabled | Yes/No |
| **CORS Whitelist** | Your app domain added to CORS | `https://composer.company.com` |

### HCL DX Server Requirements (Admin Side)

Your HCL DX administrator needs to ensure:

- HCL Digital Experience 9.5 CF213 or later
- WCM REST API enabled (`/wps/mycontenthandler/wcmrest`)
- DAM API enabled (`/dx/api/dam/v1`)
- CORS configured for your Composer domain
- Service account with appropriate WCM/DAM permissions

### Request API Access

Send this request to your HCL DX administrator:

```
Subject: API Access Request for HCL DX Composer

Please provide API access for the HCL DX Composer application:

1. Create a service account with these permissions:
   - WCM: Editor/Manager role in [Library Name]
   - DAM: Contributor role for collections
   - Workflow: Execute workflow actions

2. Enable CORS for our application domain:
   - Origin: https://[our-composer-domain]
   - Methods: GET, POST, PUT, DELETE, OPTIONS
   - Headers: Content-Type, Authorization

3. Provide the following:
   - HCL DX server hostname
   - Service account credentials
   - WCM Library name
   - LTPA2 keys (if SSO required)
```

### CORS Configuration (Admin Reference)

For HCL DX administrators - add CORS headers:

```properties
# WebSphere custom properties
Access-Control-Allow-Origin: https://your-composer-domain.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key, LtpaToken2
Access-Control-Allow-Credentials: true
```

---

## API Authentication

HCL DX Composer uses **LtpaToken2** as the primary authentication method for both DAM and WCM API calls. This is the method specified in the official HCL DX OpenAPI documentation.

### How Authentication Works

```
┌─────────────────┐     POST /wps/j_security_check      ┌──────────────────┐
│   DX Composer   │ ──────────────────────────────────▶  │   HCL DX Server  │
│    Backend      │     (username + password)             │                  │
│                 │                                       │                  │
│                 │  ◀──────────────────────────────────  │                  │
│                 │     Set-Cookie: LtpaToken2=...        │                  │
│                 │                                       │                  │
│  (cache token   │     Cookie: LtpaToken2=...            │                  │
│   for 1 hour)   │ ──────────────────────────────────▶  │  WCM/DAM APIs    │
│                 │     GET /wcmrest/Library               │                  │
└─────────────────┘                                       └──────────────────┘
```

1. **Auto-login**: On the first API call, the backend authenticates via `POST /wps/j_security_check` using the configured service account credentials
2. **Token extraction**: Extracts the `LtpaToken2` cookie from the response `Set-Cookie` header
3. **Token caching**: Caches the token in memory for 1 hour (tokens typically valid for 2 hours)
4. **Token refresh**: Automatically re-authenticates when the cached token expires
5. **Fallback**: If LTPA login fails, falls back to `Authorization: Basic` header

### Configuration

```env
# Service account credentials (used for LtpaToken2 login)
HCL_DX_USERNAME=wcmservice
HCL_DX_PASSWORD=your_secure_password
```

The backend uses these credentials to obtain `LtpaToken2` automatically. No manual token management is needed.

### Method 2: LTPA2 SSO Authentication (Optional)

For Single Sign-On with the HCL DX Portal:

1. Export the LTPA keys from WebSphere:
   ```bash
   # In WebSphere Admin Console
   Security > Global Security > LTPA > Export Keys
   ```

2. Configure in `.env`:
   ```env
   LTPA2_SECRET_KEY=base64_encoded_ltpa_key
   LTPA2_REALM=your_websphere_realm
   ```

3. The application will automatically validate LTPA2 tokens from cookies

### Authentication Best Practices

| Environment | Recommended Method |
|-------------|-------------------|
| **Production** | LtpaToken2 via service account (auto-login) |
| **SSO Users** | LTPA2 token passthrough from Portal |
| **Development** | LtpaToken2 via service account (auto-login) |

**Security Notes:**
- Never hardcode credentials in source code
- Use environment variables for all secrets
- Rotate service account passwords periodically
- Use HTTPS for all API communications
- The `LtpaToken2` is cached server-side only, never exposed to the browser

---

## WCM REST API Integration

### Base URL Configuration

`HCL_DX_WCM_BASE_URL` accepts either a path or a full URL:

```env
# Recommended: path only (combined with HCL_DX_HOST/PORT/PROTOCOL)
HCL_DX_WCM_BASE_URL=/wps/mycontenthandler/wcmrest

# Also supported: full URL
HCL_DX_WCM_BASE_URL=https://your-dx-server.com/wps/mycontenthandler/wcmrest
```

> **Note:** If not set, defaults to `/wps/mycontenthandler/wcmrest`.

### API Endpoints Used

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/Library` | GET | List all WCM libraries |
| `/Library/{id}/AuthoringTemplate` | GET | Get authoring templates in library |
| `/AuthoringTemplate/{id}` | GET | Get template details with elements |
| `/Library/{id}/PresentationTemplate` | GET | Get presentation templates |
| `/Library/{id}/Workflow` | GET | Get workflows in library |
| `/Content` | POST | Create new content item |
| `/Content/{id}` | GET, PUT | Read/update content |
| `/Content/{id}/publish` | POST | Publish content |
| `/Content/{id}/render` | GET | Headless content rendering |

### Creating Content via API

```javascript
// Example: Create WCM content via the dxService (uses LtpaToken2 automatically)
const createContent = async (contentData) => {
  // dxService.createWcmClient() auto-obtains LtpaToken2
  const client = await dxService.createWcmClient();
  
  const response = await client.post('/Content', {
    name: contentData.title,
    title: contentData.title,
    type: 'Content',
    libraryId: contentData.libraryId,
    authoringTemplateId: contentData.authoringTemplateId,
    elements: contentData.elements,
    locale: contentData.language || 'en' // For multilingual
  });
  return response.data;
};
```

### Authoring Template Element Types

The Composer supports dynamic form generation for these WCM element types:

| Element Type | Form Component | Notes |
|--------------|----------------|-------|
| `TextComponent` | Text input | Single-line text |
| `RichTextComponent` | Rich text editor | HTML content |
| `HTMLComponent` | Code editor | Raw HTML |
| `ImageComponent` | Image selector | DAM integration |
| `FileComponent` | File upload | Document attachment |
| `DateComponent` | Date picker | Date selection |
| `NumberComponent` | Number input | Numeric values |
| `OptionSelectionComponent` | Select/Radio | Predefined options |
| `LinkComponent` | URL + Text inputs | Hyperlinks |
| `UserSelectionComponent` | User picker | Portal users |

---

## DAM API Integration

### Base URL Configuration

The DAM API path (`/dx/api/dam/v1`) is auto-configured from `HCL_DX_HOST`/`HCL_DX_PORT`/`HCL_DX_PROTOCOL`. No separate `HCL_DX_DAM_BASE_URL` is required.

```env
# The DAM API URL is constructed automatically:
# ${HCL_DX_PROTOCOL}://${HCL_DX_HOST}:${HCL_DX_PORT}/dx/api/dam/v1
```

### API Endpoints Used

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/collections` | GET, POST | List/create collections |
| `/collections/{id}` | GET, PUT, DELETE | Manage collection |
| `/collections/{id}/assets` | POST | Upload asset to collection |
| `/collections/{id}/access` | PUT | Set access control |
| `/assets/{id}` | GET, PUT, DELETE | Manage individual assets |
| `/assets/{id}/renditions` | GET | Get asset renditions |

### Creating a DAM Collection

```javascript
// Example: Create DAM collection with access control
const createCollection = async (name, description) => {
  // Create collection
  const collection = await axios.post(`${DAM_BASE_URL}/collections`, {
    name,
    description,
    metadata: {
      approved: 'true',
      approvedDate: new Date().toISOString(),
      source: 'hcl-dx-composer'
    }
  });

  // Set access control
  await axios.put(`${DAM_BASE_URL}/collections/${collection.data.id}/access`, {
    access: [
      { principal: 'wpsadmin', role: 'Administrator' },
      { principal: 'Anonymous Portal User', role: 'User' }
    ]
  });

  return collection.data;
};
```

### Uploading Assets

```javascript
// Example: Upload asset to DAM (uses LtpaToken2 automatically)
const uploadAsset = async (collectionId, filePath, filename, mimeType, metadata) => {
  // dxService.uploadAsset() auto-obtains LtpaToken2 for authentication
  const result = await dxService.uploadAsset(
    collectionId, filePath, filename, mimeType, metadata
  );
  return result;
};

// Or upload to the "Not Approved Assets" collection for workflow:
const result = await dxService.uploadToNotApproved(
  filePath, filename, mimeType, metadata
);
```

> **Note:** The DAM API requires `LtpaToken2` cookie authentication per the official OpenAPI spec. The backend handles this automatically.

---

## Multilingual Content Support

### Supported Languages

| Code | Language | Native Name | Direction |
|------|----------|-------------|-----------|
| `en` | English | English | LTR |
| `hi` | Hindi | हिंदी | LTR |
| `mr` | Marathi | मराठी | LTR |

### W3C i18n Compliance

The application follows W3C Internationalization best practices:

1. **Language Tags**: Uses BCP 47 language tags (`en`, `hi`, `mr`)
2. **HTML lang Attribute**: Sets `lang` attribute on content elements
3. **Content Negotiation**: Supports `Accept-Language` header
4. **Unicode Support**: Full UTF-8 encoding for Devanagari script
5. **Locale-Aware Formatting**: Dates, numbers formatted per locale

### Creating Multilingual Content

```javascript
// Creating content with language specification
const createMultilingualContent = async (content, language) => {
  const data = {
    ...content,
    metadata: {
      ...content.metadata,
      language: language, // 'en', 'hi', or 'mr'
      translationGroupId: content.translationGroupId || uuid()
    }
  };
  
  return await wcmApi.createContent(data);
};
```

### Translation Workflow

1. Create content in primary language (e.g., English)
2. System generates a `translationGroupId`
3. Create translations with same `translationGroupId`
4. Microsite displays available translations

### HCL DX Multilingual Libraries

To leverage HCL DX native localization:

```javascript
// Specify locale when creating content
const response = await axios.post(`${WCM_BASE_URL}/Content`, {
  ...contentData,
  locale: 'hi', // Hindi locale
  // Or use library-based approach
  libraryId: 'hindi-content-library-id'
});
```

---

## Workflow Integration

### Workflow Stages

```
┌─────────┐    ┌───────────────┐    ┌──────────┐    ┌───────────┐
│  Draft  │───▶│    Pending    │───▶│ Approved │───▶│ Published │
│         │    │   Approval    │    │          │    │           │
└─────────┘    └───────────────┘    └──────────┘    └───────────┘
                      │                                    │
                      │    ┌──────────┐                    │
                      └───▶│ Rejected │◀───────────────────┘
                           └──────────┘
```

### Syncing with HCL DX Workflows

```javascript
// Execute workflow action in HCL DX using Basic Authentication
const executeWorkflowAction = async (contentId, action) => {
  const credentials = Buffer.from(`${HCL_DX_USERNAME}:${HCL_DX_PASSWORD}`).toString('base64');
  
  await axios.post(
    `${WCM_BASE_URL}/Content/${contentId}/workflow-action`,
    { action: action }, // 'approve', 'reject', 'publish'
    { headers: { 'Authorization': `Basic ${credentials}` } }
  );
};
```

### Workflow Actions Mapping

| Composer Action | HCL DX Workflow Action |
|-----------------|------------------------|
| Submit | `submit` |
| Approve | `approve` |
| Reject | `reject` |
| Publish | `publish` |

---

## Access Control Configuration

### Default ACL for DAM Collections

The application automatically sets these permissions on published collections:

```javascript
const defaultACL = {
  access: [
    { 
      principal: 'wpsadmin', 
      role: 'Administrator',
      permissions: ['read', 'write', 'delete', 'manage']
    },
    { 
      principal: 'Anonymous Portal User', 
      role: 'User',
      permissions: ['read']
    }
  ]
};
```

### Custom ACL Configuration

Configure in database `system_config` table:

```sql
UPDATE system_config 
SET config_value = '{"administrator": "PortalAdmins", "user": "All Authenticated Users"}'
WHERE config_key = 'dam_default_collection_acl';
```

---

## API Reference

### Complete API Endpoint List

#### Authentication
```
POST /api/auth/login          - LDAP authentication
POST /api/auth/logout         - Logout user
GET  /api/auth/me             - Get current user
POST /api/auth/sso/validate   - Validate LTPA2 token
```

#### DAM Workflow
```
GET    /api/dam/assets              - List staged assets
POST   /api/dam/assets/upload       - Upload single asset
POST   /api/dam/assets/upload-multiple - Upload multiple assets
POST   /api/dam/assets/:id/submit   - Submit for approval
POST   /api/dam/assets/:id/approve  - Approve asset
POST   /api/dam/assets/:id/reject   - Reject asset
POST   /api/dam/assets/:id/publish  - Publish to HCL DX
DELETE /api/dam/assets/:id          - Delete staged asset
GET    /api/dam/collections         - List collections
POST   /api/dam/collections         - Create collection
```

#### WCM Composer
```
GET  /api/wcm/libraries                    - List WCM libraries
GET  /api/wcm/libraries/:id/authoring-templates - Get templates
GET  /api/wcm/authoring-templates/:id      - Get template details
GET  /api/wcm/libraries/:id/workflows      - Get workflows
POST /api/wcm/content                      - Create content
PUT  /api/wcm/content/:id                  - Update content
POST /api/wcm/content/:id/submit           - Submit for approval
POST /api/wcm/content/:id/approve          - Approve content
POST /api/wcm/content/:id/publish          - Publish to HCL DX
GET  /api/wcm/content/:id/preview          - Get headless preview
```

#### Microsite
```
GET /api/microsite/content      - Get published WCM content
GET /api/microsite/content/:id  - Get single content with translations
GET /api/microsite/assets       - Get published DAM assets
GET /api/microsite/dx/content   - Fetch live content from HCL DX
GET /api/microsite/dx/render/:id - Render content from HCL DX
GET /api/microsite/languages    - Get supported languages
```

#### HCL DX Proxy
```
GET/POST/PUT/DELETE /api/dx/dam/*  - Proxy to DAM API
GET/POST/PUT/DELETE /api/dx/wcm/*  - Proxy to WCM API
```

---

## Troubleshooting

### Common Issues

#### 1. CORS Errors

**Symptom**: Browser console shows CORS policy errors

**Solution**:
```properties
# Add to HCL DX WebSphere custom properties
com.ibm.ws.webcontainer.ADD_STRICT_CORS_SUPPORT=true
```

#### 2. Authentication Failures

**Symptom**: 401 Unauthorized errors

**Checklist**:
- Verify `HCL_DX_USERNAME` and `HCL_DX_PASSWORD` are correct in `.env`
- Check backend logs for `LtpaToken2` login status:
  ```bash
  docker-compose logs backend | grep -i 'ltpa'
  ```
- If LTPA login fails, the backend falls back to Basic Auth — but DAM API requires LTPA
- Ensure the service account has appropriate WCM/DAM permissions
- Check LTPA2 key configuration matches WebSphere (for SSO users)

#### 3. Content Not Publishing

**Symptom**: Content approved but not appearing in DX

**Checklist**:
- Verify HCL DX WCM REST API is accessible
- Check user has Contributor role in WCM library
- Review HCL DX SystemOut.log for errors

#### 4. Multilingual Content Issues

**Symptom**: Hindi/Marathi characters displaying incorrectly

**Solution**:
- Ensure database uses UTF-8 encoding
- Set `Content-Type: application/json; charset=utf-8` headers
- Verify browser fonts support Devanagari script

### Debug Logging

Enable verbose logging:

```env
LOG_LEVEL=debug
```

View logs:
```bash
docker-compose logs -f backend
```

### HCL DX System Logs

Check HCL DX logs for API issues:
```bash
tail -f /opt/HCL/wp_profile/logs/WebSphere_Portal/SystemOut.log
```

---

## Quick Start: API Configuration

### Minimum Configuration

To get started with API-only integration, configure these environment variables:

```env
# Required: HCL DX Server
HCL_DX_HOST=dx.company.com
HCL_DX_PORT=443
HCL_DX_PROTOCOL=https

# Required: Service Account Credentials (used for auto LtpaToken2 login)
HCL_DX_USERNAME=wcmservice
HCL_DX_PASSWORD=your_secure_password

# WCM API path (path only recommended; full URL also supported)
HCL_DX_WCM_BASE_URL=/wps/mycontenthandler/wcmrest

# Target WCM Library
HCL_DX_WCM_LIBRARY=Web Content
```

> **Note:** The DAM API URL is auto-configured as `${protocol}://${host}:${port}/dx/api/dam/v1`. No separate DAM URL variable is needed.

### Test API Connectivity

After configuration, test your API connection:

```bash
# Test WCM API (replace username:password with your credentials)
curl -k -u "wcmservice:password" \
     https://dx.company.com/wps/mycontenthandler/wcmrest/Library

# Test DAM API
curl -k -u "wcmservice:password" \
     https://dx.company.com/dx/api/dam/v1/collections
```

Once deployed, verify in-app connectivity:
```bash
# Check backend startup logs for API URLs
docker-compose logs backend | grep 'HCL DX Service Configuration' -A 10
```

### Verify in Application

Run the health check to verify API connectivity:

```bash
./scripts/health-check.sh
```

Expected output:
```
✓ HCL DX WCM API: Connected
✓ HCL DX DAM API: Connected
✓ API Authentication: Valid
```

---

## API Endpoints Summary

### WCM REST API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/Library` | GET | List all WCM libraries |
| `/Library/{id}/AuthoringTemplate` | GET | Get authoring templates |
| `/Content` | POST | Create content |
| `/Content/{id}` | GET/PUT/DELETE | Manage content |
| `/Content/{id}/publish` | POST | Publish content |
| `/Content/{id}/workflow-action` | POST | Execute workflow |

### DAM API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/collections` | GET/POST | List/create collections |
| `/collections/{id}/assets` | POST | Upload asset |
| `/assets/{id}` | GET/PUT/DELETE | Manage asset |
| `/assets/{id}/renditions` | GET | Get asset renditions |

---

## References

- [HCL WCM REST API Documentation](https://support.hcl-software.com/csm?id=kb_article&sysparm_article=KB0074521)
- [HCL DX Experience API Explorer](https://github.com/HCL-TECH-SOFTWARE/experience-api-documentation)
- [HCL DX API Access Documentation](https://help.hcl-software.com/digital-experience/9.5/CF233/get_started/product_overview/api_access/)
- [HCL DAM API Reference](https://help.hcl-software.com/digital-experience/9.5/digital_asset_mgmt/dam_api.html)
- [W3C Internationalization Guidelines](https://www.w3.org/International/)

---

*Document Version: 2.0 - Pure API Integration*
*Last Updated: March 2026*
