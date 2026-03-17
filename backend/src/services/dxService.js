/**
 * HCL DX Service - Handles API communication with HCL Digital Experience
 * Supports both DAM and WCM APIs
 */

const axios = require('axios');
const https = require('https');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');
const db = require('../config/database');

// Create HTTPS agent that allows self-signed certificates (common in enterprise DX deployments)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

/**
 * HCL DX Service - Handles API communication with HCL Digital Experience
 * DAM API Reference: https://opensource.hcltechsw.com/experience-api-documentation/dam-api/
 * WCM API Reference: https://opensource.hcltechsw.com/experience-api-documentation/wcm-api/
 */
class DxService {
  constructor() {
    this.host = process.env.HCL_DX_HOST;
    this.port = process.env.HCL_DX_PORT || '443';
    this.protocol = process.env.HCL_DX_PROTOCOL || 'https';
    this.username = process.env.HCL_DX_USERNAME || 'wpsadmin';
    this.password = process.env.HCL_DX_PASSWORD;
    this.wcmBaseUrl = process.env.HCL_DX_WCM_BASE_URL;
    this.defaultLibrary = process.env.HCL_DX_WCM_LIBRARY || 'Web Content';
    
    // DAM API path per official docs: /dx/api/dam/v1
    this.damApiPath = '/dx/api/dam/v1';
    
    // Log configuration
    this.logConfiguration();
  }

  /**
   * Log configuration for debugging
   */
  logConfiguration() {
    logger.info('=== HCL DX Service Configuration ===');
    logger.info(`Host: ${this.host || 'NOT SET'}`);
    logger.info(`Port: ${this.port}`);
    logger.info(`Protocol: ${this.protocol}`);
    logger.info(`Username: ${this.username}`);
    logger.info(`Password: ${this.password ? '***SET***' : 'NOT SET'}`);
    logger.info(`DAM API: ${this.getDamApiUrl()}`);
    logger.info(`Configured: ${this.isConfigured()}`);
    logger.info('=====================================');
  }

  /**
   * Check if HCL DX is properly configured
   */
  isConfigured() {
    return !!(this.host && this.username && this.password);
  }

  /**
   * Get base URL for HCL DX
   */
  getBaseUrl() {
    return `${this.protocol}://${this.host}:${this.port}`;
  }

  /**
   * Get DAM API URL
   */
  getDamApiUrl() {
    return `${this.getBaseUrl()}${this.damApiPath}`;
  }

  /**
   * Create axios client with Basic Auth
   * HCL DX DAM API supports Basic Auth with username:password
   */
  createClient(authToken) {
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    // Always include Basic Auth for server-to-server calls
    if (this.username && this.password) {
      const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
      logger.debug(`Using Basic Auth for user: ${this.username}`);
    }

    // Additionally include LTPA token if provided (for user context)
    if (authToken) {
      headers['Cookie'] = `LtpaToken2=${authToken}`;
    }

    logger.debug(`Creating client for: ${this.getDamApiUrl()}`);
    logger.debug(`Headers: Authorization=${headers['Authorization'] ? 'Basic ***' : 'NONE'}, Cookie=${authToken ? 'LtpaToken2=***' : 'NONE'}`);

    return axios.create({
      baseURL: this.getDamApiUrl(),
      headers,
      timeout: 60000,
      httpsAgent: httpsAgent,
      validateStatus: (status) => status < 500
    });
  }

  /**
   * Save collection record to local database for tracking
   */
  async saveCollectionRecord(collection, metadata = {}) {
    try {
      await db.query(`
        INSERT INTO dx_collections (dx_collection_id, name, description, collection_type, metadata, dx_created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (dx_collection_id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          local_updated_at = NOW()
      `, [
        collection.id,
        collection.name,
        collection.description || '',
        metadata.collectionType || 'general',
        JSON.stringify(metadata),
        collection.created || new Date().toISOString()
      ]);
      logger.debug(`Collection record saved: ${collection.name} (${collection.id})`);
    } catch (error) {
      logger.warn(`Failed to save collection record: ${error.message}`);
    }
  }

  // ===========================================================================
  // DAM API Methods
  // ===========================================================================

  /**
   * Get all DAM collections
   * API: GET /collections
   * Ref: https://opensource.hcltechsw.com/experience-api-documentation/dam-api/#operation/CollectionController.find
   */
  async getCollections(authToken) {
    const reqId = Date.now();
    logger.info(`[${reqId}] DAM API: GET /collections`);
    
    try {
      const client = this.createClient(authToken);
      const response = await client.get('/collections');
      
      logger.debug(`[${reqId}] Response status: ${response.status}`);
      logger.debug(`[${reqId}] Response: ${JSON.stringify(response.data).substring(0, 500)}`);
      
      if (response.status === 401) {
        logger.error(`[${reqId}] 401 Unauthorized - Check HCL_DX_USERNAME/PASSWORD`);
        throw new Error('HCL DX authentication failed: 401 Unauthorized');
      }
      
      if (response.status !== 200) {
        throw new Error(`Failed to get collections: ${response.status} - ${JSON.stringify(response.data)}`);
      }
      
      logger.info(`[${reqId}] Found ${response.data.contents?.length || 0} collections`);
      return response.data;
    } catch (error) {
      logger.error(`[${reqId}] Error fetching DAM collections:`, {
        message: error.message,
        code: error.code
      });
      throw error;
    }
  }

  /**
   * Create a new DAM collection
   * API: POST /collections
   * Ref: https://opensource.hcltechsw.com/experience-api-documentation/dam-api/#operation/CollectionController.create
   */
  async createCollection(name, description, metadata = {}, authToken) {
    const reqId = Date.now();
    logger.info(`[${reqId}] DAM API: POST /collections - Creating "${name}"`);
    
    try {
      const client = this.createClient(authToken);
      
      // Request body per API spec
      const collectionData = {
        name: name,
        description: description || `Created by HCL DX Composer on ${new Date().toISOString()}`
      };
      
      // Add keywords if provided
      if (metadata.keywords && Array.isArray(metadata.keywords)) {
        collectionData.keywords = metadata.keywords;
      }

      logger.debug(`[${reqId}] Request body: ${JSON.stringify(collectionData)}`);
      
      const response = await client.post('/collections', collectionData);
      
      logger.debug(`[${reqId}] Response status: ${response.status}`);
      logger.debug(`[${reqId}] Response: ${JSON.stringify(response.data)}`);
      
      if (response.status === 401) {
        logger.error(`[${reqId}] 401 Unauthorized - Check HCL_DX_USERNAME/PASSWORD`);
        throw new Error('HCL DX authentication failed: 401 Unauthorized');
      }
      
      if (response.status === 409) {
        logger.warn(`[${reqId}] Collection "${name}" already exists, fetching existing...`);
        const collections = await this.getCollections(authToken);
        const existing = collections.contents?.find(c => c.name === name);
        if (existing) {
          logger.info(`[${reqId}] Found existing collection: ${existing.id}`);
          return existing;
        }
      }
      
      if (response.status !== 201 && response.status !== 200) {
        throw new Error(`Failed to create collection: ${response.status} - ${JSON.stringify(response.data)}`);
      }

      const collection = response.data;
      logger.info(`[${reqId}] Collection created: ${name} (ID: ${collection.id})`);
      
      // Save to local DB for tracking
      await this.saveCollectionRecord(collection, metadata);
      
      return collection;
    } catch (error) {
      logger.error(`[${reqId}] Error creating DAM collection:`, {
        message: error.message,
        code: error.code
      });
      throw error;
    }
  }

  /**
   * Upload asset to DAM collection
   * API: POST /collections/{collection_id}/items
   * Ref: https://opensource.hcltechsw.com/experience-api-documentation/dam-api/#operation/CollectionController.createMediaItem
   */
  async uploadAsset(collectionId, filePath, filename, mimeType, metadata = {}, authToken) {
    const reqId = Date.now();
    logger.info(`[${reqId}] DAM API: POST /collections/${collectionId}/items - Uploading "${filename}"`);
    
    try {
      // Verify file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      const fileStats = fs.statSync(filePath);
      logger.debug(`[${reqId}] File size: ${fileStats.size} bytes`);
      
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath), {
        filename: filename,
        contentType: mimeType
      });

      // Add optional fields per API spec
      if (metadata.title) {
        formData.append('title', metadata.title);
      }
      if (metadata.description) {
        formData.append('description', metadata.description);
      }
      if (metadata.keywords && Array.isArray(metadata.keywords)) {
        metadata.keywords.forEach(keyword => {
          formData.append('keywords', keyword);
        });
      }

      const headers = {
        ...formData.getHeaders(),
        'Accept': 'application/json'
      };

      // Always include Basic Auth
      if (this.username && this.password) {
        const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      }

      // Additionally include LTPA token if provided
      if (authToken) {
        headers['Cookie'] = `LtpaToken2=${authToken}`;
      }

      const url = `${this.getDamApiUrl()}/collections/${collectionId}/items`;
      logger.debug(`[${reqId}] POST ${url}`);

      const response = await axios.post(url, formData, { 
        headers, 
        timeout: 120000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        httpsAgent: httpsAgent
      });

      logger.debug(`[${reqId}] Response status: ${response.status}`);
      logger.debug(`[${reqId}] Response: ${JSON.stringify(response.data)}`);

      if (response.status === 401) {
        throw new Error('HCL DX authentication failed: 401 Unauthorized');
      }

      if (response.status !== 201 && response.status !== 200) {
        throw new Error(`Failed to upload asset: ${response.status} - ${JSON.stringify(response.data)}`);
      }

      const asset = response.data;
      logger.info(`[${reqId}] Asset uploaded: ${filename} (ID: ${asset.id})`);
      
      // Save asset record to local DB
      await this.saveAssetRecord(collectionId, asset, metadata);
      
      return asset;
    } catch (error) {
      logger.error(`[${reqId}] Error uploading asset:`, {
        message: error.message,
        code: error.code,
        response: error.response?.status
      });
      throw error;
    }
  }

  /**
   * Save asset record to local database
   */
  async saveAssetRecord(collectionId, asset, metadata = {}) {
    try {
      await db.query(`
        INSERT INTO dx_collection_assets (dx_collection_id, dx_asset_id, metadata)
        VALUES ($1, $2, $3)
        ON CONFLICT (dx_collection_id, dx_asset_id) DO UPDATE SET
          metadata = EXCLUDED.metadata
      `, [collectionId, asset.id, JSON.stringify(metadata)]);
      logger.debug(`Asset record saved: ${asset.id} in collection ${collectionId}`);
    } catch (error) {
      logger.warn(`Failed to save asset record: ${error.message}`);
    }
  }

  /**
   * Set access control on DAM collection
   * API: PUT /collections/{collection_id}/access-control
   */
  async setCollectionAccessControl(collectionId, accessControl, authToken) {
    const reqId = Date.now();
    logger.info(`[${reqId}] DAM API: Setting access control on ${collectionId}`);
    
    try {
      const client = this.createClient(authToken);
      const aclData = {
        access: [
          { principal: accessControl.administrator || 'wpsadmin', role: 'Administrator' },
          { principal: accessControl.user || 'Anonymous Portal User', role: 'User' }
        ]
      };

      const response = await client.put(`/collections/${collectionId}/access-control`, aclData);
      logger.debug(`[${reqId}] Response status: ${response.status}`);

      if (response.status !== 200) {
        logger.warn(`[${reqId}] Access control returned: ${response.status}`);
      }

      return response.data;
    } catch (error) {
      logger.warn(`[${reqId}] Error setting access control: ${error.message}`);
      return null;
    }
  }

  /**
   * Get or create a DAM collection by name
   */
  async getOrCreateCollection(name, description, metadata = {}, authToken) {
    const reqId = Date.now();
    logger.info(`[${reqId}] Getting or creating collection: "${name}"`);
    
    try {
      // First, try to find existing collection
      const collections = await this.getCollections(authToken);
      const existing = collections?.contents?.find(c => c.name === name);
      
      if (existing) {
        logger.info(`[${reqId}] Found existing collection: ${name} (${existing.id})`);
        return existing;
      }

      // Create new collection if not found
      logger.info(`[${reqId}] Collection not found, creating: ${name}`);
      const newCollection = await this.createCollection(name, description, metadata, authToken);
      
      // Set access control on new collection
      await this.setCollectionAccessControl(newCollection.id, {
        administrator: 'wpsadmin',
        user: 'Anonymous Portal User'
      }, authToken);

      return newCollection;
    } catch (error) {
      logger.error(`[${reqId}] Error getting/creating collection:`, error.message);
      throw error;
    }
  }

  /**
   * Get the "Not Approved Assets" collection (creates if doesn't exist)
   */
  async getNotApprovedCollection(authToken) {
    return this.getOrCreateCollection(
      'Not Approved Assets',
      'Assets pending approval - uploaded via AI Creative Studio and manual uploads',
      { approvalStatus: 'pending', source: 'hcl-dx-composer' },
      authToken
    );
  }

  /**
   * Get the "Approved Assets" collection (creates if doesn't exist)
   */
  async getApprovedCollection(authToken) {
    return this.getOrCreateCollection(
      'Approved Assets',
      'Approved and published assets ready for public consumption',
      { approvalStatus: 'approved', source: 'hcl-dx-composer' },
      authToken
    );
  }

  /**
   * Upload asset to "Not Approved Assets" collection
   */
  async uploadToNotApproved(filePath, filename, mimeType, metadata, authToken) {
    try {
      const collection = await this.getNotApprovedCollection(authToken);
      const asset = await this.uploadAsset(
        collection.id,
        filePath,
        filename,
        mimeType,
        {
          ...metadata,
          approved: 'false',
          approvalStatus: 'pending',
          uploadedAt: new Date().toISOString()
        },
        authToken
      );

      logger.info(`Asset uploaded to Not Approved Assets: ${filename}`);
      return {
        asset,
        collection,
        collectionName: 'Not Approved Assets'
      };
    } catch (error) {
      logger.error('Error uploading to Not Approved collection:', error.message);
      throw error;
    }
  }

  /**
   * Move asset from "Not Approved Assets" to "Approved Assets" collection
   * This involves: 1) Copy to approved collection, 2) Delete from not approved
   */
  async moveToApprovedCollection(assetId, sourceCollectionId, filePath, filename, mimeType, metadata, authToken) {
    try {
      // Get approved collection
      const approvedCollection = await this.getApprovedCollection(authToken);

      // Upload to approved collection with updated metadata
      const approvedAsset = await this.uploadAsset(
        approvedCollection.id,
        filePath,
        filename,
        mimeType,
        {
          ...metadata,
          approved: 'true',
          approvalStatus: 'approved',
          approvedAt: new Date().toISOString(),
          approvedMonth: new Date().toLocaleString('default', { month: 'long' }),
          approvedYear: new Date().getFullYear().toString()
        },
        authToken
      );

      // Delete from source collection (Not Approved Assets)
      try {
        await this.deleteAssetFromCollection(sourceCollectionId, assetId, authToken);
      } catch (deleteError) {
        logger.warn(`Could not delete asset from source collection: ${deleteError.message}`);
      }

      logger.info(`Asset moved to Approved Assets: ${filename}`);
      return {
        asset: approvedAsset,
        collection: approvedCollection,
        collectionName: 'Approved Assets'
      };
    } catch (error) {
      logger.error('Error moving asset to Approved collection:', error.message);
      throw error;
    }
  }

  /**
   * Delete asset from a DAM collection
   * API: DELETE /collections/{collection_id}/items/{item_id}
   */
  async deleteAssetFromCollection(collectionId, assetId, authToken) {
    const reqId = Date.now();
    logger.info(`[${reqId}] DAM API: DELETE /collections/${collectionId}/items/${assetId}`);
    
    try {
      const client = this.createClient(authToken);
      const response = await client.delete(`/collections/${collectionId}/items/${assetId}`);

      logger.debug(`[${reqId}] Response status: ${response.status}`);

      if (response.status !== 200 && response.status !== 204) {
        throw new Error(`Failed to delete asset: ${response.status}`);
      }

      logger.info(`[${reqId}] Asset deleted: ${assetId}`);
      return true;
    } catch (error) {
      logger.error(`[${reqId}] Error deleting asset:`, error.message);
      throw error;
    }
  }

  /**
   * Get asset details from DAM
   * API: GET /collections/{collection_id}/items/{item_id}
   */
  async getAsset(collectionId, assetId, authToken) {
    const reqId = Date.now();
    logger.info(`[${reqId}] DAM API: GET /collections/${collectionId}/items/${assetId}`);
    
    try {
      const client = this.createClient(authToken);
      const response = await client.get(`/collections/${collectionId}/items/${assetId}`);

      logger.debug(`[${reqId}] Response status: ${response.status}`);

      if (response.status !== 200) {
        throw new Error(`Failed to get asset: ${response.status}`);
      }

      return response.data;
    } catch (error) {
      logger.error(`[${reqId}] Error fetching asset:`, error.message);
      throw error;
    }
  }

  /**
   * Get items in a collection
   * API: GET /collections/{collection_id}/items
   */
  async getCollectionItems(collectionId, options = {}, authToken) {
    const reqId = Date.now();
    logger.info(`[${reqId}] DAM API: GET /collections/${collectionId}/items`);
    
    try {
      const client = this.createClient(authToken);
      const params = new URLSearchParams();
      if (options.limit) params.append('limit', options.limit);
      if (options.offset) params.append('offset', options.offset);
      
      const url = `/collections/${collectionId}/items${params.toString() ? '?' + params.toString() : ''}`;
      const response = await client.get(url);

      logger.debug(`[${reqId}] Response status: ${response.status}`);

      if (response.status !== 200) {
        throw new Error(`Failed to get collection items: ${response.status}`);
      }

      logger.info(`[${reqId}] Found ${response.data.contents?.length || 0} items`);
      return response.data;
    } catch (error) {
      logger.error(`[${reqId}] Error fetching collection items:`, error.message);
      throw error;
    }
  }

  // ===========================================================================
  // WCM API Methods
  // ===========================================================================

  /**
   * Get WCM API URL
   */
  getWcmApiUrl() {
    // WCM REST API default path
    const wcmPath = this.wcmBaseUrl || '/wps/mycontenthandler/wcmrest';
    return `${this.getBaseUrl()}${wcmPath}`;
  }

  /**
   * Create WCM client with proper authentication
   */
  createWcmClient(authToken) {
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    // Always include Basic Auth
    if (this.username && this.password) {
      const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    // Additionally include LTPA token if provided
    if (authToken) {
      headers['Cookie'] = `LtpaToken2=${authToken}`;
    }

    logger.debug(`Creating WCM client for: ${this.getWcmApiUrl()}`);

    return axios.create({
      baseURL: this.getWcmApiUrl(),
      headers,
      timeout: 60000,
      httpsAgent: httpsAgent,
      validateStatus: (status) => status < 500
    });
  }

  /**
   * Get all WCM libraries
   */
  async getLibraries(authToken) {
    const reqId = Date.now();
    logger.info(`[${reqId}] WCM API: GET /Library`);
    
    try {
      const client = this.createWcmClient(authToken);
      const response = await client.get('/Library');
      
      logger.debug(`[${reqId}] Response status: ${response.status}`);
      
      if (response.status === 401) {
        throw new Error('HCL DX authentication failed: 401 Unauthorized');
      }
      
      if (response.status !== 200) {
        throw new Error(`Failed to get libraries: ${response.status}`);
      }
      
      return response.data;
    } catch (error) {
      logger.error(`[${reqId}] Error fetching WCM libraries:`, error.message);
      throw error;
    }
  }

  /**
   * Get authoring templates from a library
   */
  async getAuthoringTemplates(libraryId, authToken) {
    try {
      const client = this.createWcmClient(authToken);
      const response = await client.get(`/Library/${libraryId}/AuthoringTemplate`);
      
      if (response.status === 401) {
        throw new Error('HCL DX authentication failed: 401 Unauthorized');
      }
      
      if (response.status !== 200) {
        throw new Error(`Failed to get authoring templates: ${response.status}`);
      }
      
      return response.data;
    } catch (error) {
      logger.error('Error fetching authoring templates:', error.message);
      throw error;
    }
  }

  /**
   * Get authoring template details (including elements)
   */
  async getAuthoringTemplateDetails(templateId, authToken) {
    try {
      const client = this.createWcmClient(authToken);
      const response = await client.get(`/AuthoringTemplate/${templateId}`);
      
      if (response.status === 401) {
        throw new Error('HCL DX authentication failed: 401 Unauthorized');
      }
      
      if (response.status !== 200) {
        throw new Error(`Failed to get template details: ${response.status}`);
      }
      
      return response.data;
    } catch (error) {
      logger.error('Error fetching authoring template details:', error.message);
      throw error;
    }
  }

  /**
   * Get presentation templates from a library
   */
  async getPresentationTemplates(libraryId, authToken) {
    try {
      const client = this.createWcmClient(authToken);
      const response = await client.get(`/Library/${libraryId}/PresentationTemplate`);
      
      if (response.status === 401) {
        throw new Error('HCL DX authentication failed: 401 Unauthorized');
      }
      
      if (response.status !== 200) {
        throw new Error(`Failed to get presentation templates: ${response.status}`);
      }
      
      return response.data;
    } catch (error) {
      logger.error('Error fetching presentation templates:', error.message);
      throw error;
    }
  }

  /**
   * Get workflows from a library
   */
  async getWorkflows(libraryId, authToken) {
    try {
      const client = this.createWcmClient(authToken);
      const response = await client.get(`/Library/${libraryId}/Workflow`);
      
      if (response.status === 401) {
        throw new Error('HCL DX authentication failed: 401 Unauthorized');
      }
      
      if (response.status !== 200) {
        throw new Error(`Failed to get workflows: ${response.status}`);
      }
      
      return response.data;
    } catch (error) {
      logger.error('Error fetching workflows:', error.message);
      throw error;
    }
  }

  /**
   * Get workflow details (including stages and actions)
   */
  async getWorkflowDetails(workflowId, authToken) {
    try {
      const client = this.createWcmClient(authToken);
      const response = await client.get(`/Workflow/${workflowId}`);
      
      if (response.status === 401) {
        throw new Error('HCL DX authentication failed: 401 Unauthorized');
      }
      
      if (response.status !== 200) {
        throw new Error(`Failed to get workflow details: ${response.status}`);
      }
      
      return response.data;
    } catch (error) {
      logger.error('Error fetching workflow details:', error.message);
      throw error;
    }
  }

  /**
   * Create WCM content item
   */
  async createContent(contentData, authToken) {
    try {
      const client = this.createWcmClient(authToken);
      
      const wcmContent = {
        name: contentData.title,
        title: contentData.title,
        type: 'Content',
        libraryId: contentData.libraryId,
        authoringTemplateId: contentData.authoringTemplateId,
        elements: contentData.elements,
        workflow: contentData.workflowId ? { id: contentData.workflowId } : undefined
      };

      const response = await client.post('/Content', wcmContent);
      
      if (response.status === 401) {
        throw new Error('HCL DX authentication failed: 401 Unauthorized');
      }
      
      if (response.status !== 201 && response.status !== 200) {
        throw new Error(`Failed to create content: ${response.status}`);
      }

      logger.info(`WCM content created: ${contentData.title}`);
      return response.data;
    } catch (error) {
      logger.error('Error creating WCM content:', error.message);
      throw error;
    }
  }

  /**
   * Execute workflow action on content
   */
  async executeWorkflowAction(contentId, action, authToken) {
    try {
      const client = this.createWcmClient(authToken);
      
      const response = await client.post(`/Content/${contentId}/workflow-action`, { action });
      
      if (response.status === 401) {
        throw new Error('HCL DX authentication failed: 401 Unauthorized');
      }
      
      if (response.status !== 200) {
        throw new Error(`Failed to execute workflow action: ${response.status}`);
      }

      logger.info(`Workflow action executed: ${action} on ${contentId}`);
      return response.data;
    } catch (error) {
      logger.error('Error executing workflow action:', error.message);
      throw error;
    }
  }

  /**
   * Publish content
   */
  async publishContent(contentId, authToken) {
    try {
      const client = this.createWcmClient(authToken);
      
      const response = await client.post(`/Content/${contentId}/publish`);
      
      if (response.status === 401) {
        throw new Error('HCL DX authentication failed: 401 Unauthorized');
      }
      
      if (response.status !== 200) {
        throw new Error(`Failed to publish content: ${response.status}`);
      }

      logger.info(`Content published: ${contentId}`);
      return response.data;
    } catch (error) {
      logger.error('Error publishing content:', error.message);
      throw error;
    }
  }

  /**
   * Get content preview (headless render)
   */
  async getContentPreview(contentId, presentationTemplateId, authToken) {
    try {
      const client = this.createWcmClient(authToken);
      
      let url = `/Content/${contentId}/render`;
      if (presentationTemplateId) {
        url += `?presentationTemplateId=${presentationTemplateId}`;
      }
      
      const response = await client.get(url);
      
      if (response.status === 401) {
        throw new Error('HCL DX authentication failed: 401 Unauthorized');
      }
      
      if (response.status !== 200) {
        throw new Error(`Failed to get content preview: ${response.status}`);
      }

      return response.data;
    } catch (error) {
      logger.error('Error getting content preview:', error.message);
      throw error;
    }
  }

  /**
   * Get content by ID
   */
  async getContent(contentId, authToken) {
    try {
      const client = this.createWcmClient(authToken);
      const response = await client.get(`/Content/${contentId}`);
      
      if (response.status === 401) {
        throw new Error('HCL DX authentication failed: 401 Unauthorized');
      }
      
      if (response.status !== 200) {
        throw new Error(`Failed to get content: ${response.status}`);
      }
      
      return response.data;
    } catch (error) {
      logger.error('Error fetching content:', error.message);
      throw error;
    }
  }

  /**
   * Move content to next workflow stage
   * Uses: POST /wps/mycontenthandler/wcmrest/item/{item-uuid}/next-stage
   */
  async moveToNextWorkflowStage(contentId, authToken) {
    try {
      const client = this.createWcmClient(authToken);
      const response = await client.post(`/item/${contentId}/next-stage`);
      
      if (response.status === 401) {
        throw new Error('HCL DX authentication failed: 401 Unauthorized');
      }
      
      if (response.status !== 200) {
        throw new Error(`Failed to move to next stage: ${response.status}`);
      }

      logger.info(`Content moved to next workflow stage: ${contentId}`);
      return response.data;
    } catch (error) {
      logger.error('Error moving to next workflow stage:', error.message);
      throw error;
    }
  }

  /**
   * Approve content in workflow
   * Uses: POST /wps/mycontenthandler/wcmrest/item/{item-uuid}/approve
   */
  async approveContentInWorkflow(contentId, authToken) {
    try {
      const client = this.createWcmClient(authToken);
      const response = await client.post(`/item/${contentId}/approve`);
      
      if (response.status === 401) {
        throw new Error('HCL DX authentication failed: 401 Unauthorized');
      }
      
      if (response.status !== 200) {
        throw new Error(`Failed to approve in workflow: ${response.status}`);
      }

      logger.info(`Content approved in workflow: ${contentId}`);
      return response.data;
    } catch (error) {
      logger.error('Error approving content in workflow:', error.message);
      throw error;
    }
  }

  /**
   * Build Atom/XML payload for WCM content creation
   * Reference: HCL WCM REST API documentation
   */
  buildAtomXmlPayload(contentData) {
    const elements = contentData.elements || {};
    let elementsXml = '';
    
    Object.entries(elements).forEach(([key, value]) => {
      const escapedValue = this.escapeXml(typeof value === 'string' ? value : JSON.stringify(value));
      elementsXml += `<wcm:element name="${key}"><wcm:data>${escapedValue}</wcm:data></wcm:element>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<atom:entry xmlns:atom="http://www.w3.org/2005/Atom" xmlns:wcm="wcm/namespace">
  <wcm:name>${this.escapeXml(contentData.title)}</wcm:name>
  <atom:title>${this.escapeXml(contentData.title)}</atom:title>
  <atom:link atom:rel="parent" atom:href="${this.wcmBaseUrl}/item/${contentData.parentId || contentData.libraryId}"/>
  <atom:link atom:rel="content-template" atom:href="${this.wcmBaseUrl}/item/${contentData.authoringTemplateId}"/>
  ${contentData.workflowId ? `<atom:link atom:rel="workflow" atom:href="${this.wcmBaseUrl}/item/${contentData.workflowId}"/>` : ''}
  ${contentData.presentationTemplateId ? `<atom:link atom:rel="presentation-template" atom:href="${this.wcmBaseUrl}/item/${contentData.presentationTemplateId}"/>` : ''}
  <wcm:content><wcm:elements>${elementsXml}</wcm:elements></wcm:content>
</atom:entry>`;
  }

  /**
   * Escape XML special characters
   */
  escapeXml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Create WCM content using Atom/XML format
   */
  async createContentAtomXml(contentData, authToken) {
    try {
      const xmlPayload = this.buildAtomXmlPayload(contentData);
      
      const headers = {
        'Content-Type': 'application/atom+xml',
        'Accept': 'application/atom+xml'
      };

      // Always include Basic Auth
      if (this.username && this.password) {
        const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      }

      // Additionally include LTPA token if provided
      if (authToken) {
        headers['Cookie'] = `LtpaToken2=${authToken}`;
      }

      const response = await axios.post(
        `${this.getWcmApiUrl()}/Content`,
        xmlPayload,
        { headers, timeout: 30000, httpsAgent: httpsAgent }
      );
      
      if (response.status === 401) {
        throw new Error('HCL DX authentication failed: 401 Unauthorized');
      }
      
      if (response.status !== 201 && response.status !== 200) {
        throw new Error(`Failed to create content: ${response.status}`);
      }

      logger.info(`WCM content created (Atom/XML): ${contentData.title}`);
      return response.data;
    } catch (error) {
      logger.error('Error creating WCM content (Atom/XML):', error.message);
      throw error;
    }
  }

  /**
   * Get public DAM asset URL
   * Returns the publicly accessible URL for a DAM asset
   */
  getAssetUrl(collectionId, assetId, rendition = 'original') {
    // DAM assets are accessible via: /dx/api/dam/v1/collections/{id}/items/{id}/renditions/{rendition}
    return `${this.getBaseUrl()}${this.damApiPath}/collections/${collectionId}/items/${assetId}/renditions/${rendition}`;
  }

  /**
   * Test connection to HCL DX
   */
  async testConnection() {
    const reqId = Date.now();
    logger.info(`[${reqId}] Testing HCL DX connection...`);
    
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'HCL DX not configured',
          details: 'Set HCL_DX_HOST, HCL_DX_USERNAME, HCL_DX_PASSWORD'
        };
      }

      const collections = await this.getCollections();
      
      return {
        success: true,
        host: this.host,
        collectionsCount: collections.contents?.length || 0,
        message: `Connected to ${this.host} - Found ${collections.contents?.length || 0} collections`
      };
    } catch (error) {
      logger.error(`[${reqId}] Connection test failed:`, error.message);
      return {
        success: false,
        host: this.host,
        error: error.message,
        details: error.response?.data || null
      };
    }
  }

  /**
   * Initialize both DAM collections and return their details
   */
  async initializeCollections(authToken) {
    const reqId = Date.now();
    logger.info(`[${reqId}] Initializing DAM collections...`);
    
    const results = {
      notApproved: null,
      approved: null,
      errors: []
    };

    try {
      const notApproved = await this.getNotApprovedCollection(authToken);
      results.notApproved = {
        id: notApproved.id,
        name: notApproved.name,
        url: this.getAssetUrl(notApproved.id, '{assetId}')
      };
    } catch (error) {
      results.errors.push(`Not Approved: ${error.message}`);
    }

    try {
      const approved = await this.getApprovedCollection(authToken);
      results.approved = {
        id: approved.id,
        name: approved.name,
        url: this.getAssetUrl(approved.id, '{assetId}')
      };
    } catch (error) {
      results.errors.push(`Approved: ${error.message}`);
    }

    return results;
  }
}

module.exports = new DxService();
