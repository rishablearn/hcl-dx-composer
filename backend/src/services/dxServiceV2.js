/**
 * HCL DX Service V2 - Enhanced API Client
 * 
 * Uses HCL Experience API (Ring API) for modern JSON-based operations
 * Reference: https://opensource.hcltechsw.com/experience-api-documentation/
 * 
 * API Endpoints:
 * - Ring API (Core): /dx/api/core/v1 - Authentication, Access Control, WCM
 * - DAM API: /dx/api/dam/v1 - Digital Asset Management
 * - WCM API: /dx/api/wcm/v1 - Web Content Management (JSON)
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const logger = require('../config/logger');

class DxServiceV2 {
  constructor() {
    this.host = process.env.HCL_DX_HOST;
    this.port = process.env.HCL_DX_PORT || '443';
    this.protocol = process.env.HCL_DX_PROTOCOL || 'https';
    this.username = process.env.HCL_DX_USERNAME;
    this.password = process.env.HCL_DX_PASSWORD;
    
    // API Base URLs
    this.ringApiBase = '/dx/api/core/v1';
    this.damApiBase = '/dx/api/dam/v1';
    this.wcmApiBase = '/dx/api/wcm/v1';
    
    // Legacy WCM REST API (fallback)
    this.wcmRestBase = process.env.HCL_DX_WCM_BASE_URL || '/wps/mycontenthandler/wcmrest';
    this.damRestBase = process.env.HCL_DX_DAM_BASE_URL || '/dx/api/dam/v1';
    
    this.defaultLibrary = process.env.HCL_DX_WCM_LIBRARY || 'Web Content';
    this.virtualPortal = process.env.HCL_DX_VIRTUAL_PORTAL || '';
    
    // Cache for session token
    this._sessionToken = null;
    this._tokenExpiry = null;
  }

  /**
   * Get base URL for HCL DX
   */
  getBaseUrl() {
    return `${this.protocol}://${this.host}:${this.port}`;
  }

  /**
   * Create axios client with authentication
   * Supports: LtpaToken2 (cookie), Basic Auth, or API Key
   */
  createClient(authToken = null, options = {}) {
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add virtual portal header if configured
    if (this.virtualPortal) {
      headers['virtualportal'] = this.virtualPortal;
    }

    // Authentication priority: LtpaToken2 > Provided token > Basic Auth
    if (authToken) {
      if (authToken.startsWith('LtpaToken2=')) {
        headers['Cookie'] = authToken;
      } else {
        headers['Cookie'] = `LtpaToken2=${authToken}`;
      }
    } else if (this.username && this.password) {
      const basicAuth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
      headers['Authorization'] = `Basic ${basicAuth}`;
    }

    return axios.create({
      baseURL: this.getBaseUrl(),
      headers,
      timeout: options.timeout || 30000,
      validateStatus: (status) => status < 500
    });
  }

  // ===========================================================================
  // Ring API - Authentication
  // ===========================================================================

  /**
   * Login via Ring API
   * POST /dx/api/core/v1/auth/login
   */
  async login(username, password) {
    try {
      const client = axios.create({
        baseURL: this.getBaseUrl(),
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });

      const response = await client.post(`${this.ringApiBase}/auth/login`, {
        username,
        password
      });

      if (response.status === 200 && response.data?.data?.UId) {
        // Extract LtpaToken2 from Set-Cookie header
        const cookies = response.headers['set-cookie'];
        let ltpaToken = null;
        
        if (cookies) {
          const ltpaCookie = cookies.find(c => c.startsWith('LtpaToken2='));
          if (ltpaCookie) {
            ltpaToken = ltpaCookie.split(';')[0].replace('LtpaToken2=', '');
          }
        }

        this._sessionToken = ltpaToken;
        this._tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

        logger.info(`Ring API login successful for user: ${username}`);
        return {
          success: true,
          userId: response.data.data.UId,
          token: ltpaToken
        };
      }

      throw new Error(response.data?.error?.message || 'Login failed');
    } catch (error) {
      logger.error('Ring API login failed:', error.message);
      throw error;
    }
  }

  /**
   * Validate session via Ring API
   * POST /dx/api/core/v1/auth/validate
   */
  async validateSession(authToken) {
    try {
      const client = this.createClient(authToken);
      const response = await client.post(`${this.ringApiBase}/auth/validate`);

      return {
        valid: response.status === 200,
        userId: response.data?.data?.UId
      };
    } catch (error) {
      logger.error('Session validation failed:', error.message);
      return { valid: false };
    }
  }

  /**
   * Logout via Ring API
   * POST /dx/api/core/v1/auth/logout
   */
  async logout(authToken) {
    try {
      const client = this.createClient(authToken);
      await client.post(`${this.ringApiBase}/auth/logout`);
      
      this._sessionToken = null;
      this._tokenExpiry = null;
      
      logger.info('Ring API logout successful');
      return { success: true };
    } catch (error) {
      logger.error('Logout failed:', error.message);
      throw error;
    }
  }

  // ===========================================================================
  // Ring API - WCM Operations (JSON-based)
  // ===========================================================================

  /**
   * Get WCM libraries via Ring API
   * GET /dx/api/core/v1/{access_type}/webcontent/libraries
   */
  async getLibraries(authToken = null, options = {}) {
    try {
      const accessType = authToken ? 'dxmyrest' : 'dxrest';
      const client = this.createClient(authToken);
      
      const params = new URLSearchParams();
      if (options.limit) params.append('limit', options.limit);
      if (options.page) params.append('page', options.page);
      
      const response = await client.get(
        `${this.ringApiBase}/${accessType}/webcontent/libraries?${params}`
      );

      if (response.status !== 200) {
        throw new Error(`Failed to get libraries: ${response.status}`);
      }

      // Transform response to consistent format
      return {
        items: response.data.contents || [],
        total: response.data.total || 0,
        page: response.data.page || 1,
        limit: response.data.limit || 100
      };
    } catch (error) {
      logger.error('Error fetching WCM libraries via Ring API:', error.message);
      // Fallback to legacy API
      return this.getLibrariesLegacy(authToken);
    }
  }

  /**
   * Get authoring templates via Ring API
   * GET /dx/api/core/v1/{access_type}/webcontent/authoring-templates
   */
  async getAuthoringTemplates(libraryId, authToken = null, options = {}) {
    try {
      const accessType = authToken ? 'dxmyrest' : 'dxrest';
      const client = this.createClient(authToken);
      
      const params = new URLSearchParams();
      params.append('libraryID', libraryId);
      if (options.limit) params.append('limit', options.limit);
      if (options.page) params.append('page', options.page);
      
      const response = await client.get(
        `${this.ringApiBase}/${accessType}/webcontent/authoring-templates?${params}`
      );

      if (response.status !== 200) {
        throw new Error(`Failed to get authoring templates: ${response.status}`);
      }

      return {
        items: response.data.contents || [],
        total: response.data.total || 0
      };
    } catch (error) {
      logger.error('Error fetching authoring templates via Ring API:', error.message);
      return this.getAuthoringTemplatesLegacy(libraryId, authToken);
    }
  }

  /**
   * Get authoring template details via Ring API
   * GET /dx/api/core/v1/{access_type}/webcontent/authoring-templates/{id}
   */
  async getAuthoringTemplateDetails(templateId, authToken = null) {
    try {
      const accessType = authToken ? 'dxmyrest' : 'dxrest';
      const client = this.createClient(authToken);
      
      const response = await client.get(
        `${this.ringApiBase}/${accessType}/webcontent/authoring-templates/${templateId}`
      );

      if (response.status !== 200) {
        throw new Error(`Failed to get template details: ${response.status}`);
      }

      return response.data;
    } catch (error) {
      logger.error('Error fetching template details via Ring API:', error.message);
      return this.getAuthoringTemplateDetailsLegacy(templateId, authToken);
    }
  }

  /**
   * Get workflows via Ring API
   * GET /dx/api/core/v1/{access_type}/webcontent/workflows
   */
  async getWorkflows(libraryId = null, authToken = null) {
    try {
      const accessType = authToken ? 'dxmyrest' : 'dxrest';
      const client = this.createClient(authToken);
      
      const params = new URLSearchParams();
      if (libraryId) params.append('libraryID', libraryId);
      
      const response = await client.get(
        `${this.ringApiBase}/${accessType}/webcontent/workflows?${params}`
      );

      if (response.status !== 200) {
        throw new Error(`Failed to get workflows: ${response.status}`);
      }

      return {
        items: response.data.contents || [],
        total: response.data.total || 0
      };
    } catch (error) {
      logger.error('Error fetching workflows via Ring API:', error.message);
      return this.getWorkflowsLegacy(libraryId, authToken);
    }
  }

  /**
   * Get workflow details via Ring API
   * GET /dx/api/core/v1/{access_type}/webcontent/workflows/{id}
   */
  async getWorkflowDetails(workflowId, authToken = null) {
    try {
      const accessType = authToken ? 'dxmyrest' : 'dxrest';
      const client = this.createClient(authToken);
      
      const response = await client.get(
        `${this.ringApiBase}/${accessType}/webcontent/workflows/${workflowId}`
      );

      if (response.status !== 200) {
        throw new Error(`Failed to get workflow details: ${response.status}`);
      }

      return response.data;
    } catch (error) {
      logger.error('Error fetching workflow details via Ring API:', error.message);
      return this.getWorkflowDetailsLegacy(workflowId, authToken);
    }
  }

  /**
   * Get workflow stages for a workflow via Ring API
   * GET /dx/api/core/v1/{access_type}/webcontent/workflows/{id}/workflow-stages
   */
  async getWorkflowStages(workflowId, authToken = null) {
    try {
      const accessType = authToken ? 'dxmyrest' : 'dxrest';
      const client = this.createClient(authToken);
      
      const response = await client.get(
        `${this.ringApiBase}/${accessType}/webcontent/workflows/${workflowId}/workflow-stages`
      );

      if (response.status !== 200) {
        throw new Error(`Failed to get workflow stages: ${response.status}`);
      }

      return {
        workflowId: response.data.workflowId,
        stages: response.data.stages || [],
        total: response.data.total || 0
      };
    } catch (error) {
      logger.error('Error fetching workflow stages:', error.message);
      throw error;
    }
  }

  /**
   * Get content items via Ring API
   * GET /dx/api/core/v1/{access_type}/webcontent/contents
   */
  async getContents(options = {}, authToken = null) {
    try {
      const accessType = authToken ? 'dxmyrest' : 'dxrest';
      const client = this.createClient(authToken);
      
      const params = new URLSearchParams();
      if (options.libraryId) params.append('libraryID', options.libraryId);
      if (options.authoringTemplateId) params.append('authoringTemplateID', options.authoringTemplateId);
      if (options.limit) params.append('limit', options.limit);
      if (options.page) params.append('page', options.page);
      if (options.sort) params.append('sort', options.sort);
      if (options.titleLike) params.append('titleLike', options.titleLike);
      
      const response = await client.get(
        `${this.ringApiBase}/${accessType}/webcontent/contents?${params}`
      );

      if (response.status !== 200) {
        throw new Error(`Failed to get contents: ${response.status}`);
      }

      return {
        items: response.data.contents || [],
        total: response.data.total || 0,
        page: response.data.page || 1
      };
    } catch (error) {
      logger.error('Error fetching contents via Ring API:', error.message);
      throw error;
    }
  }

  /**
   * Create content via Ring API
   * POST /dx/api/core/v1/{access_type}/webcontent/contents
   */
  async createContent(contentData, authToken = null) {
    try {
      const accessType = 'dxmyrest'; // Must be authenticated
      const client = this.createClient(authToken);
      
      const payload = {
        name: contentData.name || contentData.title,
        title: { value: contentData.title, lang: 'en' },
        description: contentData.description ? { value: contentData.description, lang: 'en' } : undefined,
        libraryId: contentData.libraryId,
        authoringTemplateId: contentData.authoringTemplateId,
        parentId: contentData.parentId,
        workflowId: contentData.workflowId,
        content: {
          content: {
            elements: this.transformElementsForRingApi(contentData.elements)
          }
        }
      };

      const response = await client.post(
        `${this.ringApiBase}/${accessType}/webcontent/contents`,
        payload
      );

      if (response.status !== 201 && response.status !== 200) {
        throw new Error(`Failed to create content: ${response.status}`);
      }

      logger.info(`Content created via Ring API: ${contentData.title}`);
      return response.data;
    } catch (error) {
      logger.error('Error creating content via Ring API:', error.message);
      // Fallback to legacy API
      return this.createContentLegacy(contentData, authToken);
    }
  }

  /**
   * Update content via Ring API
   * PUT /dx/api/core/v1/{access_type}/webcontent/contents/{id}
   */
  async updateContent(contentId, contentData, authToken = null) {
    try {
      const accessType = 'dxmyrest';
      const client = this.createClient(authToken);
      
      const payload = {
        title: contentData.title ? { value: contentData.title, lang: 'en' } : undefined,
        description: contentData.description ? { value: contentData.description, lang: 'en' } : undefined,
        content: contentData.elements ? {
          content: {
            elements: this.transformElementsForRingApi(contentData.elements)
          }
        } : undefined
      };

      const response = await client.put(
        `${this.ringApiBase}/${accessType}/webcontent/contents/${contentId}`,
        payload
      );

      if (response.status !== 200) {
        throw new Error(`Failed to update content: ${response.status}`);
      }

      logger.info(`Content updated via Ring API: ${contentId}`);
      return response.data;
    } catch (error) {
      logger.error('Error updating content via Ring API:', error.message);
      throw error;
    }
  }

  /**
   * Execute workflow action via Ring API
   * POST /dx/api/core/v1/{access_type}/webcontent/contents/{id}/workflow-action
   */
  async executeWorkflowAction(contentId, action, authToken = null) {
    try {
      const accessType = 'dxmyrest';
      const client = this.createClient(authToken);
      
      const response = await client.post(
        `${this.ringApiBase}/${accessType}/webcontent/contents/${contentId}/workflow-action`,
        { action }
      );

      if (response.status !== 200) {
        throw new Error(`Failed to execute workflow action: ${response.status}`);
      }

      logger.info(`Workflow action ${action} executed on content: ${contentId}`);
      return response.data;
    } catch (error) {
      logger.error('Error executing workflow action:', error.message);
      throw error;
    }
  }

  /**
   * Transform elements to Ring API format
   */
  transformElementsForRingApi(elements) {
    if (!elements) return [];
    
    return Object.entries(elements).map(([name, value]) => ({
      name,
      type: this.inferElementType(value),
      data: typeof value === 'object' ? value : { value }
    }));
  }

  /**
   * Infer element type from value
   */
  inferElementType(value) {
    if (typeof value === 'string') {
      if (value.startsWith('<') && value.endsWith('>')) return 'RichTextComponent';
      if (value.match(/^\d{4}-\d{2}-\d{2}/)) return 'DateComponent';
      return 'TextComponent';
    }
    if (typeof value === 'number') return 'NumericComponent';
    if (typeof value === 'boolean') return 'BooleanComponent';
    if (value?.href || value?.url) return 'LinkComponent';
    if (value?.id && value?.type === 'image') return 'ImageComponent';
    return 'TextComponent';
  }

  // ===========================================================================
  // DAM API Operations (v1 - already optimal)
  // ===========================================================================

  /**
   * Get all DAM collections
   * GET /dx/api/dam/v1/collections
   */
  async getCollections(authToken = null, options = {}) {
    try {
      const client = this.createClient(authToken);
      
      const params = new URLSearchParams();
      if (options.limit) params.append('limit', options.limit);
      if (options.offset) params.append('offset', options.offset);
      if (options.orderBy) params.append('orderBy', options.orderBy);
      
      const response = await client.get(`${this.damRestBase}/collections?${params}`);

      if (response.status !== 200) {
        throw new Error(`Failed to get collections: ${response.status}`);
      }

      return {
        items: response.data.contents || response.data.items || [],
        total: response.data.total || 0,
        offset: response.data.offset || 0,
        limit: response.data.limit || 100
      };
    } catch (error) {
      logger.error('Error fetching DAM collections:', error.message);
      throw error;
    }
  }

  /**
   * Create a new DAM collection
   * POST /dx/api/dam/v1/collections
   */
  async createCollection(name, description, metadata = {}, authToken = null) {
    try {
      const client = this.createClient(authToken);
      
      const collectionData = {
        name,
        description,
        ...metadata
      };

      const response = await client.post(`${this.damRestBase}/collections`, collectionData);

      if (response.status !== 201 && response.status !== 200) {
        throw new Error(`Failed to create collection: ${response.status}`);
      }

      logger.info(`DAM collection created: ${name}`);
      return response.data;
    } catch (error) {
      logger.error('Error creating DAM collection:', error.message);
      throw error;
    }
  }

  /**
   * Upload asset to DAM collection
   * POST /dx/api/dam/v1/collections/{id}/items
   */
  async uploadAsset(collectionId, filePath, filename, mimeType, metadata = {}, authToken = null) {
    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath), {
        filename,
        contentType: mimeType
      });

      if (metadata.title) formData.append('title', metadata.title);
      if (metadata.description) formData.append('description', metadata.description);
      if (metadata.keywords) {
        formData.append('keywords', JSON.stringify(metadata.keywords));
      }

      const headers = {
        ...formData.getHeaders(),
        'Accept': 'application/json'
      };

      if (authToken) {
        headers['Cookie'] = authToken.startsWith('LtpaToken2=') ? authToken : `LtpaToken2=${authToken}`;
      } else if (this.username && this.password) {
        headers['Authorization'] = `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`;
      }

      const response = await axios.post(
        `${this.getBaseUrl()}${this.damRestBase}/collections/${collectionId}/items`,
        formData,
        { headers, timeout: 60000 }
      );

      if (response.status !== 201 && response.status !== 200) {
        throw new Error(`Failed to upload asset: ${response.status}`);
      }

      logger.info(`Asset uploaded to DAM: ${filename}`);
      return response.data;
    } catch (error) {
      logger.error('Error uploading asset to DAM:', error.message);
      throw error;
    }
  }

  /**
   * Get media item details
   * GET /dx/api/dam/v1/collections/{collection_id}/items/{item_id}
   */
  async getMediaItem(collectionId, itemId, authToken = null) {
    try {
      const client = this.createClient(authToken);
      
      const response = await client.get(
        `${this.damRestBase}/collections/${collectionId}/items/${itemId}`
      );

      if (response.status !== 200) {
        throw new Error(`Failed to get media item: ${response.status}`);
      }

      return response.data;
    } catch (error) {
      logger.error('Error fetching media item:', error.message);
      throw error;
    }
  }

  /**
   * Update media item metadata
   * PATCH /dx/api/dam/v1/collections/{collection_id}/items/{item_id}
   */
  async updateMediaItem(collectionId, itemId, updates, authToken = null) {
    try {
      const client = this.createClient(authToken);
      
      const formData = new FormData();
      if (updates.title) formData.append('title', updates.title);
      if (updates.description) formData.append('description', updates.description);
      if (updates.keywords) formData.append('keywords', JSON.stringify(updates.keywords));
      if (updates.targetCollectionId) formData.append('targetCollectionId', updates.targetCollectionId);

      const response = await client.patch(
        `${this.damRestBase}/collections/${collectionId}/items/${itemId}`,
        formData,
        { headers: formData.getHeaders() }
      );

      if (response.status !== 200) {
        throw new Error(`Failed to update media item: ${response.status}`);
      }

      logger.info(`Media item updated: ${itemId}`);
      return response.data;
    } catch (error) {
      logger.error('Error updating media item:', error.message);
      throw error;
    }
  }

  /**
   * Delete media item
   * DELETE /dx/api/dam/v1/collections/{collection_id}/items/{item_id}
   */
  async deleteMediaItem(collectionId, itemId, authToken = null) {
    try {
      const client = this.createClient(authToken);
      
      const response = await client.delete(
        `${this.damRestBase}/collections/${collectionId}/items/${itemId}`
      );

      if (response.status !== 200 && response.status !== 204) {
        throw new Error(`Failed to delete media item: ${response.status}`);
      }

      logger.info(`Media item deleted: ${itemId}`);
      return { success: true };
    } catch (error) {
      logger.error('Error deleting media item:', error.message);
      throw error;
    }
  }

  /**
   * Get renditions for a media item
   * GET /dx/api/dam/v1/collections/{collection_id}/items/{item_id}/renditions
   */
  async getRenditions(collectionId, itemId, authToken = null) {
    try {
      const client = this.createClient(authToken);
      
      const response = await client.get(
        `${this.damRestBase}/collections/${collectionId}/items/${itemId}/renditions`
      );

      if (response.status !== 200) {
        throw new Error(`Failed to get renditions: ${response.status}`);
      }

      return response.data.contents || [];
    } catch (error) {
      logger.error('Error fetching renditions:', error.message);
      throw error;
    }
  }

  // ===========================================================================
  // Access Control API
  // ===========================================================================

  /**
   * Set access permissions on a resource
   * POST /dx/api/core/v1/access/permissions
   */
  async setAccessPermissions(resourceId, permissions, authToken = null) {
    try {
      const client = this.createClient(authToken);
      
      const params = new URLSearchParams();
      params.append('resourceId', resourceId);
      params.append('roleName', permissions.roleName || 'User');
      params.append('type', permissions.type || 'user');

      const response = await client.post(
        `${this.ringApiBase}/access/permissions?${params}`,
        { permissionList: permissions.principals || [] }
      );

      if (response.status !== 200) {
        throw new Error(`Failed to set permissions: ${response.status}`);
      }

      logger.info(`Permissions set on resource: ${resourceId}`);
      return response.data;
    } catch (error) {
      logger.error('Error setting access permissions:', error.message);
      throw error;
    }
  }

  // ===========================================================================
  // Legacy API Fallbacks (for backward compatibility)
  // ===========================================================================

  async getLibrariesLegacy(authToken) {
    try {
      const client = this.createClient(authToken);
      const response = await client.get(`${this.wcmRestBase}/Library`);
      
      if (response.status !== 200) {
        throw new Error(`Failed to get libraries: ${response.status}`);
      }
      
      return { items: response.data?.feed?.entry || [], total: 0 };
    } catch (error) {
      logger.error('Error fetching WCM libraries (legacy):', error.message);
      throw error;
    }
  }

  async getAuthoringTemplatesLegacy(libraryId, authToken) {
    try {
      const client = this.createClient(authToken);
      const response = await client.get(`${this.wcmRestBase}/Library/${libraryId}/AuthoringTemplate`);
      
      if (response.status !== 200) {
        throw new Error(`Failed to get authoring templates: ${response.status}`);
      }
      
      return { items: response.data?.feed?.entry || [], total: 0 };
    } catch (error) {
      logger.error('Error fetching authoring templates (legacy):', error.message);
      throw error;
    }
  }

  async getAuthoringTemplateDetailsLegacy(templateId, authToken) {
    try {
      const client = this.createClient(authToken);
      const response = await client.get(`${this.wcmRestBase}/AuthoringTemplate/${templateId}`);
      
      if (response.status !== 200) {
        throw new Error(`Failed to get template details: ${response.status}`);
      }
      
      return response.data;
    } catch (error) {
      logger.error('Error fetching template details (legacy):', error.message);
      throw error;
    }
  }

  async getWorkflowsLegacy(libraryId, authToken) {
    try {
      const client = this.createClient(authToken);
      const url = libraryId 
        ? `${this.wcmRestBase}/Library/${libraryId}/Workflow`
        : `${this.wcmRestBase}/Workflow`;
      const response = await client.get(url);
      
      if (response.status !== 200) {
        throw new Error(`Failed to get workflows: ${response.status}`);
      }
      
      return { items: response.data?.feed?.entry || [], total: 0 };
    } catch (error) {
      logger.error('Error fetching workflows (legacy):', error.message);
      throw error;
    }
  }

  async getWorkflowDetailsLegacy(workflowId, authToken) {
    try {
      const client = this.createClient(authToken);
      const response = await client.get(`${this.wcmRestBase}/Workflow/${workflowId}`);
      
      if (response.status !== 200) {
        throw new Error(`Failed to get workflow details: ${response.status}`);
      }
      
      return response.data;
    } catch (error) {
      logger.error('Error fetching workflow details (legacy):', error.message);
      throw error;
    }
  }

  async createContentLegacy(contentData, authToken) {
    try {
      const client = this.createClient(authToken);
      
      const wcmContent = {
        name: contentData.title,
        title: contentData.title,
        type: 'Content',
        libraryId: contentData.libraryId,
        authoringTemplateId: contentData.authoringTemplateId,
        elements: contentData.elements,
        workflow: contentData.workflowId ? { id: contentData.workflowId } : undefined
      };

      const response = await client.post(`${this.wcmRestBase}/Content`, wcmContent);
      
      if (response.status !== 201 && response.status !== 200) {
        throw new Error(`Failed to create content: ${response.status}`);
      }

      logger.info(`WCM content created (legacy): ${contentData.title}`);
      return response.data;
    } catch (error) {
      logger.error('Error creating WCM content (legacy):', error.message);
      throw error;
    }
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Health check for HCL DX APIs
   */
  async healthCheck() {
    const results = {
      ringApi: false,
      damApi: false,
      wcmApi: false
    };

    try {
      // Check Ring API
      const ringClient = this.createClient();
      const ringResponse = await ringClient.get(`${this.ringApiBase}/anonymous-resources`);
      results.ringApi = ringResponse.status === 200;
    } catch (error) {
      logger.warn('Ring API health check failed:', error.message);
    }

    try {
      // Check DAM API
      const damClient = this.createClient();
      const damResponse = await damClient.get(`${this.damRestBase}/api-version`);
      results.damApi = damResponse.status === 200;
    } catch (error) {
      logger.warn('DAM API health check failed:', error.message);
    }

    return results;
  }

  /**
   * Get API versions
   */
  async getApiVersions() {
    try {
      const client = this.createClient();
      const response = await client.get(`${this.damRestBase}/api-version`);
      
      return {
        dam: response.data || [],
        ring: 'v1',
        wcm: 'v1'
      };
    } catch (error) {
      logger.error('Error fetching API versions:', error.message);
      return { dam: [], ring: 'v1', wcm: 'v1' };
    }
  }
}

module.exports = new DxServiceV2();
