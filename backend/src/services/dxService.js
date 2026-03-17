/**
 * HCL DX Service - Handles API communication with HCL Digital Experience
 * Supports both DAM and WCM APIs
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const logger = require('../config/logger');

class DxService {
  constructor() {
    this.host = process.env.HCL_DX_HOST;
    this.port = process.env.HCL_DX_PORT || '443';
    this.protocol = process.env.HCL_DX_PROTOCOL || 'https';
    this.apiKey = process.env.HCL_DX_API_KEY;
    this.damBaseUrl = process.env.HCL_DX_DAM_BASE_URL;
    this.wcmBaseUrl = process.env.HCL_DX_WCM_BASE_URL;
    this.defaultLibrary = process.env.HCL_DX_WCM_LIBRARY || 'Web Content';
    
    // Log configuration status
    if (this.isConfigured()) {
      logger.info(`DX Service configured: ${this.getBaseUrl()}`);
    } else {
      logger.warn('DX Service not configured - HCL DX integration disabled');
    }
  }

  /**
   * Check if HCL DX is properly configured
   */
  isConfigured() {
    return !!(this.host && (this.apiKey || this.damBaseUrl || this.wcmBaseUrl));
  }

  /**
   * Get base URL for HCL DX
   */
  getBaseUrl() {
    return `${this.protocol}://${this.host}:${this.port}`;
  }

  /**
   * Create axios instance with authentication
   */
  createClient(authToken) {
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    if (authToken) {
      headers['Cookie'] = `LtpaToken2=${authToken}`;
    } else if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return axios.create({
      baseURL: this.getBaseUrl(),
      headers,
      timeout: 30000,
      validateStatus: (status) => status < 500
    });
  }

  // ===========================================================================
  // DAM API Methods
  // ===========================================================================

  /**
   * Get all DAM collections
   */
  async getCollections(authToken) {
    try {
      const client = this.createClient(authToken);
      const response = await client.get(`${this.damBaseUrl}/collections`);
      
      if (response.status !== 200) {
        throw new Error(`Failed to get collections: ${response.status}`);
      }
      
      return response.data;
    } catch (error) {
      logger.error('Error fetching DAM collections:', error.message);
      throw error;
    }
  }

  /**
   * Create a new DAM collection
   */
  async createCollection(name, description, metadata, authToken) {
    try {
      const client = this.createClient(authToken);
      
      const collectionData = {
        name,
        description,
        metadata: {
          ...metadata,
          approved: 'true',
          approvedDate: new Date().toISOString(),
          approvedMonth: new Date().toLocaleString('default', { month: 'long' }),
          approvedYear: new Date().getFullYear().toString()
        }
      };

      const response = await client.post(`${this.damBaseUrl}/collections`, collectionData);
      
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
   */
  async uploadAsset(collectionId, filePath, filename, mimeType, metadata, authToken) {
    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath), {
        filename,
        contentType: mimeType
      });

      if (metadata) {
        formData.append('metadata', JSON.stringify({
          ...metadata,
          approved: 'true',
          approvedDate: new Date().toISOString()
        }));
      }

      const headers = {
        ...formData.getHeaders(),
        'Accept': 'application/json'
      };

      if (authToken) {
        headers['Cookie'] = `LtpaToken2=${authToken}`;
      } else if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await axios.post(
        `${this.damBaseUrl}/collections/${collectionId}/assets`,
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
   * Set access control on DAM collection
   */
  async setCollectionAccessControl(collectionId, accessControl, authToken) {
    try {
      const client = this.createClient(authToken);
      
      const aclData = {
        access: [
          { principal: accessControl.administrator || 'wpsadmin', role: 'Administrator' },
          { principal: accessControl.user || 'Anonymous Portal User', role: 'User' }
        ]
      };

      const response = await client.put(
        `${this.damBaseUrl}/collections/${collectionId}/access`,
        aclData
      );

      if (response.status !== 200) {
        throw new Error(`Failed to set access control: ${response.status}`);
      }

      logger.info(`Access control set on collection: ${collectionId}`);
      return response.data;
    } catch (error) {
      logger.error('Error setting collection access control:', error.message);
      throw error;
    }
  }

  /**
   * Get or create a DAM collection by name
   * Used for "Not Approved Assets" and "Approved Assets" collections
   */
  async getOrCreateCollection(name, description, metadata = {}, authToken) {
    try {
      // First, try to find existing collection
      const collections = await this.getCollections(authToken);
      const existing = collections?.items?.find(c => c.name === name);
      
      if (existing) {
        logger.info(`Found existing DAM collection: ${name} (${existing.id})`);
        return existing;
      }

      // Create new collection if not found
      const newCollection = await this.createCollection(name, description, metadata, authToken);
      
      // Set access control on new collection
      await this.setCollectionAccessControl(newCollection.id, {
        administrator: 'wpsadmin',
        user: 'Anonymous Portal User'
      }, authToken);

      return newCollection;
    } catch (error) {
      logger.error(`Error getting/creating collection ${name}:`, error.message);
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
   */
  async deleteAssetFromCollection(collectionId, assetId, authToken) {
    try {
      const client = this.createClient(authToken);
      const response = await client.delete(
        `${this.damBaseUrl}/collections/${collectionId}/assets/${assetId}`
      );

      if (response.status !== 200 && response.status !== 204) {
        throw new Error(`Failed to delete asset: ${response.status}`);
      }

      logger.info(`Asset deleted from collection: ${assetId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting asset from collection:', error.message);
      throw error;
    }
  }

  /**
   * Get asset details from DAM
   */
  async getAsset(assetId, authToken) {
    try {
      const client = this.createClient(authToken);
      const response = await client.get(`${this.damBaseUrl}/assets/${assetId}`);

      if (response.status !== 200) {
        throw new Error(`Failed to get asset: ${response.status}`);
      }

      return response.data;
    } catch (error) {
      logger.error('Error fetching asset:', error.message);
      throw error;
    }
  }

  // ===========================================================================
  // WCM API Methods
  // ===========================================================================

  /**
   * Get all WCM libraries
   */
  async getLibraries(authToken) {
    try {
      const client = this.createClient(authToken);
      const response = await client.get(`${this.wcmBaseUrl}/Library`);
      
      if (response.status !== 200) {
        throw new Error(`Failed to get libraries: ${response.status}`);
      }
      
      return response.data;
    } catch (error) {
      logger.error('Error fetching WCM libraries:', error.message);
      throw error;
    }
  }

  /**
   * Get authoring templates from a library
   */
  async getAuthoringTemplates(libraryId, authToken) {
    try {
      const client = this.createClient(authToken);
      const response = await client.get(
        `${this.wcmBaseUrl}/Library/${libraryId}/AuthoringTemplate`
      );
      
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
      const client = this.createClient(authToken);
      const response = await client.get(`${this.wcmBaseUrl}/AuthoringTemplate/${templateId}`);
      
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
      const client = this.createClient(authToken);
      const response = await client.get(
        `${this.wcmBaseUrl}/Library/${libraryId}/PresentationTemplate`
      );
      
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
      const client = this.createClient(authToken);
      const response = await client.get(
        `${this.wcmBaseUrl}/Library/${libraryId}/Workflow`
      );
      
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
      const client = this.createClient(authToken);
      const response = await client.get(`${this.wcmBaseUrl}/Workflow/${workflowId}`);
      
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

      const response = await client.post(`${this.wcmBaseUrl}/Content`, wcmContent);
      
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
      const client = this.createClient(authToken);
      
      const response = await client.post(
        `${this.wcmBaseUrl}/Content/${contentId}/workflow-action`,
        { action }
      );
      
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
      const client = this.createClient(authToken);
      
      const response = await client.post(
        `${this.wcmBaseUrl}/Content/${contentId}/publish`
      );
      
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
      const client = this.createClient(authToken);
      
      let url = `${this.wcmBaseUrl}/Content/${contentId}/render`;
      if (presentationTemplateId) {
        url += `?presentationTemplateId=${presentationTemplateId}`;
      }
      
      const response = await client.get(url);
      
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
      const client = this.createClient(authToken);
      const response = await client.get(`${this.wcmBaseUrl}/Content/${contentId}`);
      
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
      const client = this.createClient(authToken);
      const response = await client.post(
        `${this.wcmBaseUrl}/item/${contentId}/next-stage`
      );
      
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
      const client = this.createClient(authToken);
      const response = await client.post(
        `${this.wcmBaseUrl}/item/${contentId}/approve`
      );
      
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

      if (authToken) {
        headers['Cookie'] = `LtpaToken2=${authToken}`;
      } else if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await axios.post(
        `${this.wcmBaseUrl}/Content`,
        xmlPayload,
        { headers, timeout: 30000 }
      );
      
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
}

module.exports = new DxService();
