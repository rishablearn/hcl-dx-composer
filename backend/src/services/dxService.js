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
    
    // LTPA Token cache for authentication
    this.ltpaToken = null;
    this.ltpaTokenExpiry = null;
    
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
    logger.info(`WCM API: ${this.getWcmApiUrl()}`);
    logger.info(`WCM Base URL (raw env): ${this.wcmBaseUrl || '(not set, using default /wps/mycontenthandler/wcmrest)'}`);
    logger.info(`Configured: ${this.isConfigured()}`);
    logger.info('=====================================');
  }

  /**
   * Check if HCL DX is properly configured
   * Also detects placeholder values from .env.example to avoid long connection timeouts
   */
  isConfigured() {
    if (!this.host || !this.username || !this.password) return false;
    // Detect common placeholder values that would cause connection hangs
    const placeholders = ['your-dx-server', 'your-hostname', 'localhost.placeholder', 'CHANGE_ME', 'example.com'];
    if (placeholders.some(p => this.host.includes(p))) return false;
    if (this.password === 'CHANGE_ME_dx_service_password') return false;
    return true;
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
   * Login to HCL DX and obtain LtpaToken2
   * DAM and WCM APIs require LtpaToken2 cookie authentication
   */
  async login() {
    const reqId = Date.now();
    
    // Return cached token if still valid (tokens typically valid for 2 hours, we refresh at 1 hour)
    if (this.ltpaToken && this.ltpaTokenExpiry && Date.now() < this.ltpaTokenExpiry) {
      logger.debug(`[${reqId}] Using cached LTPA token`);
      return this.ltpaToken;
    }

    logger.info(`[${reqId}] Logging in to HCL DX to obtain LtpaToken2...`);
    
    try {
      // HCL DX Portal login endpoint
      const loginUrl = `${this.getBaseUrl()}/wps/portal/cxml/04_SD9ePMtCP1I800I_KydQvyHFUBADPmuQy`;
      
      // Try j_security_check first (WebSphere form-based auth)
      const formData = new URLSearchParams();
      formData.append('j_username', this.username);
      formData.append('j_password', this.password);

      const response = await axios.post(
        `${this.getBaseUrl()}/wps/j_security_check`,
        formData.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          httpsAgent: httpsAgent,
          maxRedirects: 0,
          timeout: 15000, // 15s timeout for login
          validateStatus: () => true // Accept all status codes - we handle errors ourselves
        }
      );

      logger.info(`[${reqId}] j_security_check response status: ${response.status}`);

      // Extract LtpaToken2 from Set-Cookie header
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        for (const cookie of cookies) {
          if (cookie.includes('LtpaToken2=')) {
            const match = cookie.match(/LtpaToken2=([^;]+)/);
            if (match) {
              this.ltpaToken = match[1];
              // Set expiry to 1 hour from now (tokens usually valid for 2 hours)
              this.ltpaTokenExpiry = Date.now() + (60 * 60 * 1000);
              logger.info(`[${reqId}] Successfully obtained LtpaToken2`);
              return this.ltpaToken;
            }
          }
        }
      }

      // If j_security_check didn't return token, try Basic Auth to get token
      logger.info(`[${reqId}] Trying Basic Auth to obtain token...`);
      const basicAuthResponse = await axios.get(
        `${this.getBaseUrl()}/wps/mycontenthandler`,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`
          },
          httpsAgent: httpsAgent,
          maxRedirects: 5,
          timeout: 15000, // 15s timeout for login fallback
          validateStatus: () => true // Accept all status codes - we handle errors ourselves
        }
      );

      logger.info(`[${reqId}] Basic Auth login response status: ${basicAuthResponse.status}`);

      const basicCookies = basicAuthResponse.headers['set-cookie'];
      if (basicCookies) {
        for (const cookie of basicCookies) {
          if (cookie.includes('LtpaToken2=')) {
            const match = cookie.match(/LtpaToken2=([^;]+)/);
            if (match) {
              this.ltpaToken = match[1];
              this.ltpaTokenExpiry = Date.now() + (60 * 60 * 1000);
              logger.info(`[${reqId}] Successfully obtained LtpaToken2 via Basic Auth`);
              return this.ltpaToken;
            }
          }
        }
      }

      logger.warn(`[${reqId}] Could not obtain LtpaToken2, falling back to Basic Auth for API calls`);
      return null;
    } catch (error) {
      logger.error(`[${reqId}] Login failed: ${error.message} (code: ${error.code || 'N/A'})`);
      if (error.code === 'ENOTFOUND') {
        logger.error(`[${reqId}] HCL DX host not found: ${this.host}. Is the hostname correct?`);
      } else if (error.code === 'ECONNREFUSED') {
        logger.error(`[${reqId}] Connection refused to ${this.getBaseUrl()}. Is HCL DX running?`);
      } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        logger.error(`[${reqId}] Connection timed out to ${this.getBaseUrl()}. Check network/firewall.`);
      }
      return null;
    }
  }

  /**
   * Get LTPA token (login if needed)
   */
  async getLtpaToken() {
    if (!this.ltpaToken || !this.ltpaTokenExpiry || Date.now() >= this.ltpaTokenExpiry) {
      await this.login();
    }
    return this.ltpaToken;
  }

  /**
   * Create axios client with LtpaToken2 authentication
   * DAM API requires LtpaToken2 cookie (per official docs)
   */
  async createClient(providedToken) {
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    // Get LTPA token (use provided or fetch new one)
    const ltpaToken = providedToken || await this.getLtpaToken();
    
    if (ltpaToken) {
      headers['Cookie'] = `LtpaToken2=${ltpaToken}`;
      logger.debug(`Using LtpaToken2 authentication`);
    } else {
      // Fallback to Basic Auth if LTPA token not available
      if (this.username && this.password) {
        const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
        logger.debug(`Fallback to Basic Auth for user: ${this.username}`);
      }
    }

    logger.debug(`Creating client for: ${this.getDamApiUrl()}`);

    return axios.create({
      baseURL: this.getDamApiUrl(),
      headers,
      timeout: 30000,
      httpsAgent: httpsAgent,
      // Accept all status codes - we handle errors in each method
      validateStatus: () => true
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
      const client = await this.createClient(authToken);
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
      const client = await this.createClient(authToken);
      
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

      // Get LTPA token for authentication (DAM API requires LtpaToken2 cookie)
      const ltpaToken = authToken || await this.getLtpaToken();
      if (ltpaToken) {
        headers['Cookie'] = `LtpaToken2=${ltpaToken}`;
        logger.debug(`[${reqId}] Using LtpaToken2 for upload authentication`);
      } else {
        // Fallback to Basic Auth if LTPA not available
        if (this.username && this.password) {
          const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
          headers['Authorization'] = `Basic ${auth}`;
          logger.debug(`[${reqId}] Fallback to Basic Auth for upload`);
        }
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
      const client = await this.createClient(authToken);
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
      const client = await this.createClient(authToken);
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
      const client = await this.createClient(authToken);
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
      const client = await this.createClient(authToken);
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
    // WCM REST API default path - use /wps/mycontenthandler for authenticated access
    const wcmBaseUrl = this.wcmBaseUrl || '/wps/mycontenthandler/wcmrest';
    
    // If wcmBaseUrl is already a full URL (starts with http:// or https://), use it directly
    // Otherwise treat it as a path and prepend the base URL
    let url;
    if (wcmBaseUrl.startsWith('http://') || wcmBaseUrl.startsWith('https://')) {
      url = wcmBaseUrl;
    } else {
      url = `${this.getBaseUrl()}${wcmBaseUrl}`;
    }
    
    logger.debug(`WCM API URL: ${url}`);
    return url;
  }

  /**
   * Create WCM client with proper authentication
   * WCM REST API requires LtpaToken2 cookie authentication
   */
  async createWcmClient(providedToken) {
    const headers = {
      'Accept': 'application/json, application/atom+xml',
      'Content-Type': 'application/json'
    };

    // Get LTPA token (use provided or fetch new one)
    const ltpaToken = providedToken || await this.getLtpaToken();

    if (ltpaToken) {
      headers['Cookie'] = `LtpaToken2=${ltpaToken}`;
      logger.debug(`WCM Auth: Using LtpaToken2 authentication`);
    } else {
      // Fallback to Basic Auth if LTPA token not available
      if (this.username && this.password) {
        const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
        logger.debug(`WCM Auth: Fallback to Basic Auth for user ${this.username}`);
      } else {
        logger.warn('WCM Auth: No credentials configured!');
      }
    }

    const wcmUrl = this.getWcmApiUrl();
    logger.info(`Creating WCM client for: ${wcmUrl}`);

    return axios.create({
      baseURL: wcmUrl,
      headers,
      timeout: 30000,
      httpsAgent: httpsAgent,
      // Accept all status codes - we handle errors in each method
      validateStatus: () => true
    });
  }

  /**
   * Get all WCM libraries
   */
  async getLibraries(authToken) {
    const reqId = Date.now();
    const wcmUrl = this.getWcmApiUrl();
    logger.info(`[${reqId}] WCM API: GET /Library`);
    logger.info(`[${reqId}] WCM URL: ${wcmUrl}/Library`);
    
    try {
      const client = await this.createWcmClient(authToken);
      const response = await client.get('/Library');
      
      logger.info(`[${reqId}] Response status: ${response.status}`);
      logger.debug(`[${reqId}] Response content-type: ${response.headers['content-type']}`);
      
      if (response.status === 401) {
        logger.error(`[${reqId}] 401 Unauthorized - Check HCL_DX_USERNAME and HCL_DX_PASSWORD`);
        throw new Error(`HCL DX authentication failed: 401 Unauthorized. Verify credentials for user: ${this.username}`);
      }
      
      if (response.status === 403) {
        logger.error(`[${reqId}] 403 Forbidden - User may lack WCM permissions`);
        throw new Error(`HCL DX access denied: 403 Forbidden. User ${this.username} may lack WCM permissions.`);
      }
      
      if (response.status === 404) {
        logger.error(`[${reqId}] 404 Not Found - WCM API path may be incorrect`);
        logger.error(`[${reqId}] Attempted URL: ${wcmUrl}/Library`);
        throw new Error(`WCM API not found at ${wcmUrl}/Library. Check HCL_DX_WCM_BASE_URL setting. Current value: "${this.wcmBaseUrl || '(not set)'}"`);
      }
      
      if (response.status !== 200) {
        logger.error(`[${reqId}] Unexpected status: ${response.status}`, response.data);
        throw new Error(`Failed to get libraries: ${response.status} - ${JSON.stringify(response.data)}`);
      }
      
      // Handle response - WCM REST API may return XML string instead of parsed JSON
      let data = response.data;
      if (typeof data === 'string') {
        logger.warn(`[${reqId}] WCM API returned string response (likely XML). Content-type: ${response.headers['content-type']}`);
        // Try to parse as JSON in case it's a JSON string
        try {
          data = JSON.parse(data);
        } catch (parseErr) {
          logger.error(`[${reqId}] Response is not JSON. First 500 chars: ${data.substring(0, 500)}`);
          throw new Error(`WCM API returned non-JSON response. The API may require 'Accept: application/json' header or the URL may be incorrect. URL: ${wcmUrl}/Library`);
        }
      }
      
      const entryCount = data?.feed?.entry?.length || 0;
      logger.info(`[${reqId}] Successfully fetched ${entryCount} WCM libraries`);
      return data;
    } catch (error) {
      logger.error(`[${reqId}] Error fetching WCM libraries: ${error.message} (code: ${error.code || 'N/A'})`);
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Cannot connect to HCL DX at ${this.getBaseUrl()}. Check HCL_DX_HOST and ensure the server is running.`);
      }
      if (error.code === 'ENOTFOUND') {
        throw new Error(`HCL DX host not found: ${this.host}. Check HCL_DX_HOST setting. Current value may be a placeholder.`);
      }
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        throw new Error(`Connection to HCL DX timed out at ${this.getBaseUrl()}. Check network connectivity and firewall rules.`);
      }
      throw error;
    }
  }

  /**
   * Get authoring templates from a library
   */
  async getAuthoringTemplates(libraryId, authToken) {
    try {
      const client = await this.createWcmClient(authToken);
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
      const client = await this.createWcmClient(authToken);
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
      const client = await this.createWcmClient(authToken);
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
      const client = await this.createWcmClient(authToken);
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
      const client = await this.createWcmClient(authToken);
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
      const client = await this.createWcmClient(authToken);
      
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
      const client = await this.createWcmClient(authToken);
      
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
      const client = await this.createWcmClient(authToken);
      
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
      const client = await this.createWcmClient(authToken);
      
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
      const client = await this.createWcmClient(authToken);
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
      const client = await this.createWcmClient(authToken);
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
      const client = await this.createWcmClient(authToken);
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
   * Test connection to HCL DX (both DAM and WCM)
   */
  async testConnection() {
    const reqId = Date.now();
    logger.info(`[${reqId}] Testing HCL DX connection...`);
    
    const result = {
      success: false,
      host: this.host,
      port: this.port,
      protocol: this.protocol,
      username: this.username,
      configured: this.isConfigured(),
      dam: { tested: false, success: false, error: null },
      wcm: { tested: false, success: false, error: null }
    };

    if (!this.isConfigured()) {
      result.error = 'HCL DX not configured';
      result.details = 'Set HCL_DX_HOST, HCL_DX_USERNAME, HCL_DX_PASSWORD';
      return result;
    }

    // Test DAM API
    try {
      logger.info(`[${reqId}] Testing DAM API at ${this.getDamApiUrl()}`);
      const collections = await this.getCollections();
      result.dam = {
        tested: true,
        success: true,
        collectionsCount: collections.contents?.length || 0,
        url: this.getDamApiUrl()
      };
    } catch (error) {
      logger.error(`[${reqId}] DAM test failed:`, error.message);
      result.dam = {
        tested: true,
        success: false,
        error: error.message,
        url: this.getDamApiUrl()
      };
    }

    // Test WCM API
    try {
      logger.info(`[${reqId}] Testing WCM API at ${this.getWcmApiUrl()}`);
      const client = await this.createWcmClient();
      const response = await client.get('/Library');
      
      if (response.status === 200) {
        result.wcm = {
          tested: true,
          success: true,
          librariesCount: response.data?.feed?.entry?.length || 0,
          url: this.getWcmApiUrl()
        };
      } else {
        result.wcm = {
          tested: true,
          success: false,
          status: response.status,
          error: `HTTP ${response.status}`,
          url: this.getWcmApiUrl()
        };
      }
    } catch (error) {
      logger.error(`[${reqId}] WCM test failed:`, error.message);
      result.wcm = {
        tested: true,
        success: false,
        error: error.message,
        url: this.getWcmApiUrl()
      };
    }

    result.success = result.dam.success || result.wcm.success;
    result.message = result.success 
      ? `Connected to ${this.host}` 
      : `Connection failed to ${this.host}`;

    return result;
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
