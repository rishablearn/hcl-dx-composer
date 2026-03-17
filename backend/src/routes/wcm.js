/**
 * WCM Headless Composer Routes
 * Handles content authoring, workflows, and HCL DX WCM integration
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const dxService = require('../services/dxService');
const { authenticateToken, requireAuthor, requireApprover } = require('../middleware/auth');
const logger = require('../config/logger');

// ===========================================================================
// WCM API v2 Demo Data (matches HCL DX WCM API v2 response format)
// Reference: https://opensource.hcltechsw.com/experience-api-documentation/wcm-api/
// ===========================================================================

/**
 * Returns demo libraries in the exact WCM API v2 response format.
 * Real API returns: { id, title: {lang, value}, displayTitle, name, type: "Library", links: [...], data: {...} }
 */
function getDemoLibraries() {
  return {
    items: [
      {
        id: 'b5a8f5c1-4a2e-4d3b-9c1f-2e8a7b6d5c4e',
        title: { lang: 'en', value: 'Web Content' },
        displayTitle: 'Web Content',
        name: 'Web Content',
        type: 'Library',
        lastModified: new Date().toISOString(),
        data: { allowDeletion: false, enabled: true, language: 'en' }
      },
      {
        id: 'a3c7d2e1-5b6f-4e8a-b9d0-1c3e5f7a9b2d',
        title: { lang: 'en', value: 'Marketing Content' },
        displayTitle: 'Marketing Content',
        name: 'Marketing Content',
        type: 'Library',
        lastModified: new Date().toISOString(),
        data: { allowDeletion: true, enabled: true, language: 'en' }
      },
      {
        id: 'e9f1a2b3-c4d5-4e6f-a7b8-c9d0e1f2a3b4',
        title: { lang: 'en', value: 'Intranet Content' },
        displayTitle: 'Intranet Content',
        name: 'Intranet Content',
        type: 'Library',
        lastModified: new Date().toISOString(),
        data: { allowDeletion: true, enabled: true, language: 'en' }
      }
    ],
    total: 3,
    _demo: true
  };
}

/**
 * Returns demo content templates (authoring templates) in WCM API v2 format.
 * Real API: GET /content-templates?libraryID={id}
 */
function getDemoAuthoringTemplates(libraryId) {
  return {
    items: [
      {
        id: 'tmpl-article-' + libraryId.substring(0, 8),
        title: { lang: 'en', value: 'Article' },
        displayTitle: 'Article',
        name: 'Article',
        type: 'ContentTemplate',
        libraryID: libraryId,
        data: {
          headline: { name: 'headline', title: { lang: 'en', value: 'Headline' }, type: 'ShortTextComponent', data: { type: 'text/plain', value: '' } },
          summary: { name: 'summary', title: { lang: 'en', value: 'Summary' }, type: 'TextComponent', data: { type: 'text/plain', value: '' } },
          body: { name: 'body', title: { lang: 'en', value: 'Body Content' }, type: 'RichTextComponent', data: { type: 'text/html', value: '' } },
          author: { name: 'author', title: { lang: 'en', value: 'Author Name' }, type: 'ShortTextComponent', data: { type: 'text/plain', value: '' } },
          publishDate: { name: 'publishDate', title: { lang: 'en', value: 'Publish Date' }, type: 'DateComponent', data: { type: 'application/vnd.ibm.wcm+xml' } },
          featuredImage: { name: 'featuredImage', title: { lang: 'en', value: 'Featured Image' }, type: 'ImageComponent', data: { type: 'application/vnd.ibm.wcm+xml' } }
        }
      },
      {
        id: 'tmpl-news-' + libraryId.substring(0, 8),
        title: { lang: 'en', value: 'News Item' },
        displayTitle: 'News Item',
        name: 'News Item',
        type: 'ContentTemplate',
        libraryID: libraryId,
        data: {
          title: { name: 'title', title: { lang: 'en', value: 'Title' }, type: 'ShortTextComponent', data: { type: 'text/plain', value: '' } },
          content: { name: 'content', title: { lang: 'en', value: 'Content' }, type: 'RichTextComponent', data: { type: 'text/html', value: '' } },
          category: { name: 'category', title: { lang: 'en', value: 'Category' }, type: 'OptionSelectionComponent', data: { type: 'application/vnd.ibm.wcm+xml', optionselection: { displaytype: 'Automatic', selection: 'UserDefined', options: { mode: 'Singleselect' } } } }
        }
      },
      {
        id: 'tmpl-landing-' + libraryId.substring(0, 8),
        title: { lang: 'en', value: 'Landing Page' },
        displayTitle: 'Landing Page',
        name: 'Landing Page',
        type: 'ContentTemplate',
        libraryID: libraryId,
        data: {
          pageTitle: { name: 'pageTitle', title: { lang: 'en', value: 'Page Title' }, type: 'ShortTextComponent', data: { type: 'text/plain', value: '' } },
          heroImage: { name: 'heroImage', title: { lang: 'en', value: 'Hero Image' }, type: 'ImageComponent', data: { type: 'application/vnd.ibm.wcm+xml' } },
          introText: { name: 'introText', title: { lang: 'en', value: 'Introduction' }, type: 'RichTextComponent', data: { type: 'text/html', value: '' } }
        }
      }
    ],
    total: 3,
    _demo: true
  };
}

/**
 * Returns demo presentation templates in WCM API v2 format.
 */
function getDemoPresentationTemplates(libraryId) {
  return {
    items: [
      { id: 'pt-article-' + libraryId.substring(0, 8), title: { lang: 'en', value: 'Article Layout' }, displayTitle: 'Article Layout', name: 'Article Layout', type: 'PresentationTemplate', libraryID: libraryId },
      { id: 'pt-news-' + libraryId.substring(0, 8), title: { lang: 'en', value: 'News Layout' }, displayTitle: 'News Layout', name: 'News Layout', type: 'PresentationTemplate', libraryID: libraryId },
      { id: 'pt-landing-' + libraryId.substring(0, 8), title: { lang: 'en', value: 'Landing Page Layout' }, displayTitle: 'Landing Page Layout', name: 'Landing Page Layout', type: 'PresentationTemplate', libraryID: libraryId }
    ],
    total: 3,
    _demo: true
  };
}

/**
 * Returns demo workflows in WCM API v2 format.
 */
function getDemoWorkflows(libraryId) {
  return {
    items: [
      { id: 'wf-standard-' + libraryId.substring(0, 8), title: { lang: 'en', value: 'Standard Publish Workflow' }, displayTitle: 'Standard Publish Workflow', name: 'Standard Publish Workflow', type: 'Workflow', libraryID: libraryId },
      { id: 'wf-express-' + libraryId.substring(0, 8), title: { lang: 'en', value: 'Express Publish' }, displayTitle: 'Express Publish', name: 'Express Publish', type: 'Workflow', libraryID: libraryId }
    ],
    total: 2,
    _demo: true
  };
}

// ===========================================================================
// Library & Template Routes
// ===========================================================================

/**
 * GET /api/wcm/libraries
 * Get all WCM libraries from HCL DX
 * Response format matches WCM API v2: { items: [{id, title: {lang, value}, name, type, ...}], total }
 */
router.get('/libraries', authenticateToken, async (req, res) => {
  try {
    if (!dxService.isConfigured()) {
      logger.info('HCL DX not configured - returning demo WCM libraries');
      return res.json(getDemoLibraries());
    }

    const authToken = req.user?.ltpaToken || null;
    const libraries = await dxService.getLibraries(authToken);
    res.json(libraries);
  } catch (error) {
    logger.error('Error fetching WCM libraries:', error.message);
    // Return demo data on error so frontend always has something to display
    logger.info('Returning demo WCM libraries due to error');
    res.json(getDemoLibraries());
  }
});

/**
 * GET /api/wcm/libraries/:id/authoring-templates
 * Get authoring templates (content templates) from a specific library
 * Per WCM API v2 docs: GET /content-templates?libraryID={id}
 */
router.get('/libraries/:id/authoring-templates', authenticateToken, async (req, res) => {
  try {
    if (!dxService.isConfigured()) {
      return res.json(getDemoAuthoringTemplates(req.params.id));
    }
    const authToken = req.user?.ltpaToken || null;
    const templates = await dxService.getAuthoringTemplates(req.params.id, authToken);
    res.json(templates);
  } catch (error) {
    logger.error('Error fetching authoring templates:', error.message);
    res.json(getDemoAuthoringTemplates(req.params.id));
  }
});

/**
 * GET /api/wcm/authoring-templates/:id
 * Get authoring template details (including elements for form generation)
 */
router.get('/authoring-templates/:id', authenticateToken, async (req, res) => {
  try {
    if (!dxService.isConfigured()) {
      // Return a basic template detail structure
      return res.json({
        id: req.params.id,
        title: { lang: 'en', value: 'Content Template' },
        type: 'ContentTemplate',
        data: {
          title: { name: 'title', title: { lang: 'en', value: 'Title' }, type: 'ShortTextComponent', data: { type: 'text/plain', value: '' } },
          body: { name: 'body', title: { lang: 'en', value: 'Body' }, type: 'RichTextComponent', data: { type: 'text/html', value: '' } }
        },
        _demo: true
      });
    }
    const authToken = req.user?.ltpaToken || null;
    const template = await dxService.getAuthoringTemplateDetails(req.params.id, authToken);
    res.json(template);
  } catch (error) {
    logger.error('Error fetching authoring template details:', error.message);
    res.status(500).json({ error: 'Failed to fetch authoring template details' });
  }
});

/**
 * GET /api/wcm/libraries/:id/presentation-templates
 * Get presentation templates from a specific library
 */
router.get('/libraries/:id/presentation-templates', authenticateToken, async (req, res) => {
  try {
    if (!dxService.isConfigured()) {
      return res.json(getDemoPresentationTemplates(req.params.id));
    }
    const authToken = req.user?.ltpaToken || null;
    const templates = await dxService.getPresentationTemplates(req.params.id, authToken);
    res.json(templates);
  } catch (error) {
    logger.error('Error fetching presentation templates:', error.message);
    res.json(getDemoPresentationTemplates(req.params.id));
  }
});

/**
 * GET /api/wcm/libraries/:id/workflows
 * Get workflows from a specific library
 */
router.get('/libraries/:id/workflows', authenticateToken, async (req, res) => {
  try {
    if (!dxService.isConfigured()) {
      return res.json(getDemoWorkflows(req.params.id));
    }
    const authToken = req.user?.ltpaToken || null;
    const workflows = await dxService.getWorkflows(req.params.id, authToken);
    res.json(workflows);
  } catch (error) {
    logger.error('Error fetching workflows:', error.message);
    res.json(getDemoWorkflows(req.params.id));
  }
});

/**
 * GET /api/wcm/workflows/:id
 * Get workflow details (stages and actions)
 */
router.get('/workflows/:id', authenticateToken, async (req, res) => {
  try {
    if (!dxService.isConfigured()) {
      return res.json({
        id: req.params.id,
        title: { lang: 'en', value: 'Workflow' },
        type: 'Workflow',
        stages: [
          { name: 'Draft', actions: ['submit'] },
          { name: 'Review', actions: ['approve', 'reject'] },
          { name: 'Published', actions: [] }
        ],
        _demo: true
      });
    }
    const authToken = req.user?.ltpaToken || null;
    const workflow = await dxService.getWorkflowDetails(req.params.id, authToken);
    res.json(workflow);
  } catch (error) {
    logger.error('Error fetching workflow details:', error);
    res.status(500).json({ error: 'Failed to fetch workflow details' });
  }
});

// ===========================================================================
// Staged Content Routes
// ===========================================================================

/**
 * GET /api/wcm/content
 * Get all staged WCM content
 */
router.get('/content', authenticateToken, async (req, res) => {
  try {
    const { status, library_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT wc.*, u.username as created_by_username, u.display_name as created_by_name,
             au.username as approved_by_username
      FROM wcm_staged_content wc
      LEFT JOIN users u ON wc.created_by = u.id
      LEFT JOIN users au ON wc.approved_by = au.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND wc.status = $${params.length}`;
    }

    if (library_id) {
      params.push(library_id);
      query += ` AND wc.library_id = $${params.length}`;
    }

    query += ` ORDER BY wc.created_at DESC`;
    
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM wcm_staged_content WHERE 1=1';
    const countParams = [];
    if (status) {
      countParams.push(status);
      countQuery += ` AND status = $${countParams.length}`;
    }
    if (library_id) {
      countParams.push(library_id);
      countQuery += ` AND library_id = $${countParams.length}`;
    }
    const countResult = await db.query(countQuery, countParams);

    res.json({
      content: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching WCM content:', error);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

/**
 * GET /api/wcm/content/:id
 * Get single content item
 */
router.get('/content/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT wc.*, u.username as created_by_username, u.display_name as created_by_name,
             au.username as approved_by_username
      FROM wcm_staged_content wc
      LEFT JOIN users u ON wc.created_by = u.id
      LEFT JOIN users au ON wc.approved_by = au.id
      WHERE wc.id = $1
    `, [req.params.id]);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Content not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching content:', error);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

/**
 * POST /api/wcm/content
 * Create new staged content (Authors only)
 */
router.post('/content', authenticateToken, requireAuthor, async (req, res) => {
  try {
    const {
      title,
      libraryId,
      libraryName,
      authoringTemplateId,
      authoringTemplateName,
      presentationTemplateId,
      presentationTemplateName,
      workflowId,
      workflowName,
      contentElements,
      metadata
    } = req.body;

    if (!title || !libraryId || !authoringTemplateId) {
      return res.status(400).json({ 
        error: 'Title, library, and authoring template are required' 
      });
    }

    const result = await db.query(`
      INSERT INTO wcm_staged_content (
        title, library_id, library_name, authoring_template_id, authoring_template_name,
        presentation_template_id, presentation_template_name, workflow_id, workflow_name,
        current_workflow_stage, content_elements, metadata, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft', $13)
      RETURNING *
    `, [
      title,
      libraryId,
      libraryName || 'Web Content',
      authoringTemplateId,
      authoringTemplateName || '',
      presentationTemplateId || null,
      presentationTemplateName || null,
      workflowId || null,
      workflowName || null,
      'Draft',
      JSON.stringify(contentElements || {}),
      JSON.stringify(metadata || {}),
      req.user.id
    ]);

    // Record workflow history
    await db.query(`
      INSERT INTO workflow_history (entity_type, entity_id, action, to_status, performed_by)
      VALUES ('wcm_content', $1, 'create', 'draft', $2)
    `, [result.rows[0].id, req.user.id]);

    logger.info(`WCM content created: ${title} by ${req.user.username}`);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error creating WCM content:', error);
    res.status(500).json({ error: 'Failed to create content' });
  }
});

/**
 * PUT /api/wcm/content/:id
 * Update staged content
 */
router.put('/content/:id', authenticateToken, requireAuthor, async (req, res) => {
  try {
    const {
      title,
      presentationTemplateId,
      presentationTemplateName,
      contentElements,
      metadata
    } = req.body;

    // Check ownership or admin
    const existingResult = await db.query(
      'SELECT * FROM wcm_staged_content WHERE id = $1',
      [req.params.id]
    );

    if (!existingResult.rows[0]) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const existing = existingResult.rows[0];
    const isOwner = existing.created_by === req.user.id;
    const isAdmin = (req.user.roles || []).includes('wpsadmin');

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (existing.status !== 'draft' && existing.status !== 'rejected') {
      return res.status(400).json({ error: 'Can only edit draft or rejected content' });
    }

    const result = await db.query(`
      UPDATE wcm_staged_content SET
        title = COALESCE($2, title),
        presentation_template_id = COALESCE($3, presentation_template_id),
        presentation_template_name = COALESCE($4, presentation_template_name),
        content_elements = COALESCE($5, content_elements),
        metadata = COALESCE($6, metadata),
        status = 'draft',
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [
      req.params.id,
      title,
      presentationTemplateId,
      presentationTemplateName,
      contentElements ? JSON.stringify(contentElements) : null,
      metadata ? JSON.stringify(metadata) : null
    ]);

    await db.query(`
      INSERT INTO workflow_history (entity_type, entity_id, action, performed_by)
      VALUES ('wcm_content', $1, 'update', $2)
    `, [req.params.id, req.user.id]);

    logger.info(`WCM content updated: ${req.params.id} by ${req.user.username}`);

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating WCM content:', error);
    res.status(500).json({ error: 'Failed to update content' });
  }
});

/**
 * POST /api/wcm/content/:id/submit
 * Submit content for approval
 */
router.post('/content/:id/submit', authenticateToken, requireAuthor, async (req, res) => {
  try {
    const result = await db.query(`
      UPDATE wcm_staged_content 
      SET status = 'pending_approval', 
          current_workflow_stage = 'Pending Approval',
          updated_at = NOW()
      WHERE id = $1 AND created_by = $2 AND status IN ('draft', 'rejected')
      RETURNING *
    `, [req.params.id, req.user.id]);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Content not found or cannot be submitted' });
    }

    await db.query(`
      INSERT INTO workflow_history (entity_type, entity_id, action, from_status, to_status, performed_by)
      VALUES ('wcm_content', $1, 'submit', 'draft', 'pending_approval', $2)
    `, [req.params.id, req.user.id]);

    logger.info(`WCM content submitted: ${req.params.id}`);

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error submitting content:', error);
    res.status(500).json({ error: 'Failed to submit content' });
  }
});

/**
 * POST /api/wcm/content/:id/approve
 * Approve content (Approvers only)
 */
router.post('/content/:id/approve', authenticateToken, requireApprover, async (req, res) => {
  try {
    const result = await db.query(`
      UPDATE wcm_staged_content 
      SET status = 'approved', 
          current_workflow_stage = 'Approved',
          approved_by = $2, 
          approved_at = NOW(), 
          updated_at = NOW()
      WHERE id = $1 AND status = 'pending_approval'
      RETURNING *
    `, [req.params.id, req.user.id]);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Content not found or cannot be approved' });
    }

    await db.query(`
      INSERT INTO workflow_history (entity_type, entity_id, action, from_status, to_status, performed_by)
      VALUES ('wcm_content', $1, 'approve', 'pending_approval', 'approved', $2)
    `, [req.params.id, req.user.id]);

    logger.info(`WCM content approved: ${req.params.id} by ${req.user.username}`);

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error approving content:', error);
    res.status(500).json({ error: 'Failed to approve content' });
  }
});

/**
 * POST /api/wcm/content/:id/reject
 * Reject content (Approvers only)
 */
router.post('/content/:id/reject', authenticateToken, requireApprover, async (req, res) => {
  try {
    const { reason } = req.body;

    const result = await db.query(`
      UPDATE wcm_staged_content 
      SET status = 'rejected', 
          current_workflow_stage = 'Rejected',
          rejection_reason = $2, 
          updated_at = NOW()
      WHERE id = $1 AND status = 'pending_approval'
      RETURNING *
    `, [req.params.id, reason || 'No reason provided']);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Content not found or cannot be rejected' });
    }

    await db.query(`
      INSERT INTO workflow_history (entity_type, entity_id, action, from_status, to_status, performed_by, comments)
      VALUES ('wcm_content', $1, 'reject', 'pending_approval', 'rejected', $2, $3)
    `, [req.params.id, req.user.id, reason]);

    logger.info(`WCM content rejected: ${req.params.id} by ${req.user.username}`);

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error rejecting content:', error);
    res.status(500).json({ error: 'Failed to reject content' });
  }
});

/**
 * POST /api/wcm/content/:id/publish
 * Publish approved content to HCL DX WCM (or mark as published locally if DX not configured)
 */
router.post('/content/:id/publish', authenticateToken, requireApprover, async (req, res) => {
  try {
    // Get content details
    const contentResult = await db.query(
      'SELECT * FROM wcm_staged_content WHERE id = $1 AND status = $2',
      [req.params.id, 'approved']
    );

    if (!contentResult.rows[0]) {
      return res.status(404).json({ error: 'Content not found or not approved' });
    }

    const content = contentResult.rows[0];

    // Check if HCL DX is configured
    if (!dxService.isConfigured()) {
      // DX not configured - just update local status
      const result = await db.query(`
        UPDATE wcm_staged_content 
        SET status = 'published', 
            current_workflow_stage = 'Published',
            published_at = NOW(), 
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [req.params.id]);

      await db.query(`
        INSERT INTO workflow_history (entity_type, entity_id, action, from_status, to_status, performed_by, metadata)
        VALUES ('wcm_content', $1, 'publish', 'approved', 'published', $2, $3)
      `, [req.params.id, req.user.id, JSON.stringify({ mode: 'local', note: 'HCL DX not configured' })]);

      logger.info(`WCM content published locally (DX not configured): ${req.params.id}`);

      return res.json({
        success: true,
        content: result.rows[0],
        dxContent: null,
        message: 'Content published locally. HCL DX integration not configured.'
      });
    }

    // HCL DX is configured - proceed with DX publish
    try {
      // Create content in HCL DX WCM
      const dxContent = await dxService.createContent({
        title: content.title,
        libraryId: content.library_id,
        authoringTemplateId: content.authoring_template_id,
        elements: content.content_elements,
        workflowId: content.workflow_id
      });

      // Publish the content
      await dxService.publishContent(dxContent.id);

      // Update staged content
      const result = await db.query(`
        UPDATE wcm_staged_content 
        SET status = 'published', 
            current_workflow_stage = 'Published',
            published_at = NOW(), 
            dx_content_id = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [req.params.id, dxContent.id]);

      await db.query(`
        INSERT INTO workflow_history (entity_type, entity_id, action, from_status, to_status, performed_by, metadata)
        VALUES ('wcm_content', $1, 'publish', 'approved', 'published', $2, $3)
      `, [req.params.id, req.user.id, JSON.stringify({ dx_content_id: dxContent.id })]);

      logger.info(`WCM content published: ${req.params.id} -> ${dxContent.id}`);

      res.json({
        success: true,
        content: result.rows[0],
        dxContent: {
          id: dxContent.id
        }
      });
    } catch (dxError) {
      logger.error('Failed to publish content to DX:', dxError);
      // Fall back to local publish
      const result = await db.query(`
        UPDATE wcm_staged_content 
        SET status = 'published', 
            current_workflow_stage = 'Published',
            published_at = NOW(), 
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [req.params.id]);

      await db.query(`
        INSERT INTO workflow_history (entity_type, entity_id, action, from_status, to_status, performed_by, metadata)
        VALUES ('wcm_content', $1, 'publish', 'approved', 'published', $2, $3)
      `, [req.params.id, req.user.id, JSON.stringify({ mode: 'local', error: dxError.message })]);

      return res.json({
        success: true,
        content: result.rows[0],
        dxContent: null,
        message: 'Content published locally. DX publish failed: ' + dxError.message
      });
    }
  } catch (error) {
    logger.error('Error publishing content:', error);
    res.status(500).json({ error: 'Failed to publish content' });
  }
});

/**
 * GET /api/wcm/content/:id/preview
 * Get content preview using headless WCM API
 */
router.get('/content/:id/preview', authenticateToken, async (req, res) => {
  try {
    const contentResult = await db.query(
      'SELECT * FROM wcm_staged_content WHERE id = $1',
      [req.params.id]
    );

    if (!contentResult.rows[0]) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const content = contentResult.rows[0];

    // If content is published in DX, get preview from there
    if (content.dx_content_id) {
      try {
        const preview = await dxService.getContentPreview(
          content.dx_content_id,
          content.presentation_template_id
        );
        return res.json({ preview, source: 'dx' });
      } catch (dxError) {
        logger.warn('Failed to get DX preview, using local content:', dxError.message);
      }
    }

    // Return local content for preview
    res.json({
      preview: {
        title: content.title,
        elements: content.content_elements,
        template: content.authoring_template_name,
        presentationTemplate: content.presentation_template_name
      },
      source: 'local'
    });
  } catch (error) {
    logger.error('Error getting content preview:', error);
    res.status(500).json({ error: 'Failed to get content preview' });
  }
});

/**
 * DELETE /api/wcm/content/:id
 * Delete staged content
 */
router.delete('/content/:id', authenticateToken, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    const isAdmin = roles.includes('wpsadmin');

    let query = 'DELETE FROM wcm_staged_content WHERE id = $1';
    const params = [req.params.id];

    if (!isAdmin) {
      query += ' AND created_by = $2 AND status IN ($3, $4)';
      params.push(req.user.id, 'draft', 'rejected');
    }

    query += ' RETURNING *';
    const result = await db.query(query, params);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Content not found or access denied' });
    }

    logger.info(`WCM content deleted: ${req.params.id} by ${req.user.username}`);

    res.json({ success: true, message: 'Content deleted' });
  } catch (error) {
    logger.error('Error deleting content:', error);
    res.status(500).json({ error: 'Failed to delete content' });
  }
});

/**
 * POST /api/wcm/content/:id/next-stage
 * Move content to next workflow stage in HCL DX
 * Uses: POST /wps/mycontenthandler/wcmrest/item/{item-uuid}/next-stage
 */
router.post('/content/:id/next-stage', authenticateToken, requireApprover, async (req, res) => {
  try {
    const contentResult = await db.query(
      'SELECT * FROM wcm_staged_content WHERE id = $1',
      [req.params.id]
    );

    if (!contentResult.rows[0]) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const content = contentResult.rows[0];

    if (!content.dx_content_id) {
      return res.status(400).json({ error: 'Content not published to HCL DX yet' });
    }

    try {
      // Call HCL DX WCM REST API to move to next workflow stage
      const result = await dxService.moveToNextWorkflowStage(content.dx_content_id);

      // Update local workflow stage
      await db.query(`
        UPDATE wcm_staged_content 
        SET current_workflow_stage = $2, updated_at = NOW()
        WHERE id = $1
      `, [req.params.id, result.currentStage || 'Next Stage']);

      await db.query(`
        INSERT INTO workflow_history (entity_type, entity_id, action, performed_by, metadata)
        VALUES ('wcm_content', $1, 'next-stage', $2, $3)
      `, [req.params.id, req.user.id, JSON.stringify({ dx_response: result })]);

      logger.info(`WCM content moved to next stage: ${req.params.id}`);

      res.json({ success: true, currentStage: result.currentStage });
    } catch (dxError) {
      logger.error('Failed to move content to next stage in DX:', dxError);
      return res.status(500).json({ error: 'Failed to move content to next workflow stage' });
    }
  } catch (error) {
    logger.error('Error moving content to next stage:', error);
    res.status(500).json({ error: 'Failed to move content to next stage' });
  }
});

/**
 * POST /api/wcm/content/:id/dx-approve
 * Approve content in HCL DX workflow
 * Uses: POST /wps/mycontenthandler/wcmrest/item/{item-uuid}/approve
 */
router.post('/content/:id/dx-approve', authenticateToken, requireApprover, async (req, res) => {
  try {
    const contentResult = await db.query(
      'SELECT * FROM wcm_staged_content WHERE id = $1',
      [req.params.id]
    );

    if (!contentResult.rows[0]) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const content = contentResult.rows[0];

    if (!content.dx_content_id) {
      return res.status(400).json({ error: 'Content not published to HCL DX yet' });
    }

    try {
      // Call HCL DX WCM REST API to approve
      const result = await dxService.approveContentInWorkflow(content.dx_content_id);

      await db.query(`
        INSERT INTO workflow_history (entity_type, entity_id, action, performed_by, metadata)
        VALUES ('wcm_content', $1, 'dx-approve', $2, $3)
      `, [req.params.id, req.user.id, JSON.stringify({ dx_response: result })]);

      logger.info(`WCM content approved in DX workflow: ${req.params.id}`);

      res.json({ success: true, result });
    } catch (dxError) {
      logger.error('Failed to approve content in DX workflow:', dxError);
      return res.status(500).json({ error: 'Failed to approve content in HCL DX workflow' });
    }
  } catch (error) {
    logger.error('Error approving content in DX workflow:', error);
    res.status(500).json({ error: 'Failed to approve content in DX workflow' });
  }
});

/**
 * GET /api/wcm/workflow-stats
 * Get WCM workflow statistics
 */
router.get('/workflow-stats', authenticateToken, async (req, res) => {
  try {
    const statsResult = await db.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM wcm_staged_content
      GROUP BY status
    `);

    const recentResult = await db.query(`
      SELECT wh.*, wc.title, u.username, u.display_name
      FROM workflow_history wh
      JOIN wcm_staged_content wc ON wh.entity_id = wc.id AND wh.entity_type = 'wcm_content'
      JOIN users u ON wh.performed_by = u.id
      ORDER BY wh.created_at DESC
      LIMIT 10
    `);

    const stats = {
      draft: 0,
      pending_approval: 0,
      approved: 0,
      published: 0,
      rejected: 0
    };

    statsResult.rows.forEach(row => {
      stats[row.status] = parseInt(row.count);
    });

    res.json({
      stats,
      recentActivity: recentResult.rows
    });
  } catch (error) {
    logger.error('Error fetching WCM workflow stats:', error);
    res.status(500).json({ error: 'Failed to fetch workflow statistics' });
  }
});

module.exports = router;
