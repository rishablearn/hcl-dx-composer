# HCL Digital Experience Integration Guide

This document provides comprehensive guidance on integrating the HCL DX Composer application with HCL Digital Experience (DX) APIs, including the Web Content Manager (WCM) and Digital Asset Management (DAM) modules.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Authentication Methods](#authentication-methods)
4. [WCM REST API Integration](#wcm-rest-api-integration)
5. [DAM API Integration](#dam-api-integration)
6. [Multilingual Content Support](#multilingual-content-support)
7. [Workflow Integration](#workflow-integration)
8. [Access Control Configuration](#access-control-configuration)
9. [API Reference](#api-reference)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The HCL DX Composer integrates with HCL Digital Experience through its REST APIs to provide:

- **Headless WCM Content Management**: Create, edit, and publish content using Authoring Templates
- **DAM Asset Management**: Upload, approve, and publish digital assets
- **Workflow Orchestration**: Visual workflow stages with approval processes
- **Multilingual Support**: Content creation in English, Hindi (हिंदी), and Marathi (मराठी)
- **SSO Integration**: LTPA2 token-based Single Sign-On with HCL DX Portal

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    HCL DX Composer                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   React     │  │   Express   │  │     PostgreSQL          │ │
│  │  Frontend   │──│   Backend   │──│   Staging Database      │ │
│  └─────────────┘  └──────┬──────┘  └─────────────────────────┘ │
└────────────────────────────┼────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    HCL Digital Experience                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  WCM REST   │  │   DAM API   │  │   Portal Security       │ │
│  │    API      │  │             │  │   (LTPA2, LDAP)         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### HCL DX Server Requirements

- HCL Digital Experience 9.5 CF213 or later
- WCM REST API enabled
- DAM module installed and configured
- CORS configured to allow requests from the Composer application

### Enable WCM REST API

On your HCL DX server, ensure the WCM REST service is enabled:

```xml
<!-- In wp_profile/config/cells/<cell>/applications/wcm.ear/deployment.xml -->
<moduleRef name="wcm-rest-module">
  <startingWeight>100</startingWeight>
</moduleRef>
```

### Configure CORS for API Access

Add CORS headers in your HCL DX WebSphere configuration:

```properties
# Custom properties in WebSphere
Access-Control-Allow-Origin: https://your-composer-domain.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, LtpaToken2
Access-Control-Allow-Credentials: true
```

---

## Authentication Methods

### Method 1: API Key Authentication

Generate an API key in HCL DX Portal Administration:

1. Navigate to **Portal Administration > Security > API Keys**
2. Create a new API key with appropriate permissions
3. Configure in `.env`:

```env
HCL_DX_API_KEY=your_generated_api_key
```

### Method 2: LTPA2 SSO Authentication

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

### Method 3: Basic Authentication (Development Only)

For development/testing only:

```env
HCL_DX_USERNAME=wpsadmin
HCL_DX_PASSWORD=your_password
```

---

## WCM REST API Integration

### Base URL Configuration

```env
HCL_DX_WCM_BASE_URL=https://your-dx-server.com/wps/mycontenthandler/wcmrest
```

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
// Example: Create WCM content
const createContent = async (contentData) => {
  const response = await axios.post(`${WCM_BASE_URL}/Content`, {
    name: contentData.title,
    title: contentData.title,
    type: 'Content',
    libraryId: contentData.libraryId,
    authoringTemplateId: contentData.authoringTemplateId,
    elements: contentData.elements,
    locale: contentData.language || 'en' // For multilingual
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    }
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

```env
HCL_DX_DAM_BASE_URL=https://your-dx-server.com/dx/api/dam/v1
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
// Example: Upload asset to DAM
const uploadAsset = async (collectionId, file, metadata) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('metadata', JSON.stringify(metadata));

  const response = await axios.post(
    `${DAM_BASE_URL}/collections/${collectionId}/assets`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${API_KEY}`
      }
    }
  );
  return response.data;
};
```

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
// Execute workflow action in HCL DX
const executeWorkflowAction = async (contentId, action) => {
  await axios.post(
    `${WCM_BASE_URL}/Content/${contentId}/workflow-action`,
    { action: action }, // 'approve', 'reject', 'publish'
    { headers: { 'Authorization': `Bearer ${API_KEY}` } }
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
- Verify API key is valid and not expired
- Check LTPA2 key configuration matches WebSphere
- Ensure user has required portal roles

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

## References

- [HCL WCM REST API Documentation](https://support.hcl-software.com/csm?id=kb_article&sysparm_article=KB0074521)
- [HCL DX Experience API Explorer](https://github.com/HCL-TECH-SOFTWARE/experience-api-documentation)
- [HCL DX API Access Documentation](https://help.hcl-software.com/digital-experience/9.5/CF233/get_started/product_overview/api_access/)
- [W3C Internationalization Guidelines](https://www.w3.org/International/)
- [BCP 47 Language Tags](https://www.rfc-editor.org/rfc/bcp/bcp47.txt)

---

*Document Version: 1.0*
*Last Updated: March 2026*
