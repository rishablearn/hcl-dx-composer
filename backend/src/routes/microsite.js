/**
 * Microsite Routes
 * Public routes for viewing published content with HCL DX integration
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const dxService = require('../services/dxService');
const logger = require('../config/logger');

// Supported languages
const SUPPORTED_LANGUAGES = ['en', 'hi', 'mr'];

/**
 * GET /api/microsite/content
 * Get all published WCM content for the microsite
 */
router.get('/content', async (req, res) => {
  try {
    const { language, category, limit = 20, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT wc.*, u.username as created_by_username, u.display_name as created_by_name
      FROM wcm_staged_content wc
      LEFT JOIN users u ON wc.created_by = u.id
      WHERE wc.status = 'published'
    `;
    const params = [];

    if (language && SUPPORTED_LANGUAGES.includes(language)) {
      params.push(language);
      query += ` AND (wc.metadata->>'language' = $${params.length} OR wc.metadata->>'language' IS NULL)`;
    }

    query += ` ORDER BY wc.published_at DESC NULLS LAST, wc.created_at DESC`;
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await db.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM wcm_staged_content WHERE status = 'published'`;
    const countParams = [];
    if (language && SUPPORTED_LANGUAGES.includes(language)) {
      countParams.push(language);
      countQuery += ` AND (metadata->>'language' = $1 OR metadata->>'language' IS NULL)`;
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
    logger.error('Error fetching microsite content:', error);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

/**
 * GET /api/microsite/content/:id
 * Get single published content item with translations
 */
router.get('/content/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT wc.*, u.username as created_by_username, u.display_name as created_by_name
      FROM wcm_staged_content wc
      LEFT JOIN users u ON wc.created_by = u.id
      WHERE wc.id = $1 AND wc.status = 'published'
    `, [req.params.id]);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const content = result.rows[0];

    // Get translations if available
    if (content.metadata?.translationGroupId) {
      const translationsResult = await db.query(`
        SELECT id, metadata->>'language' as language, title
        FROM wcm_staged_content
        WHERE metadata->>'translationGroupId' = $1 AND id != $2 AND status = 'published'
      `, [content.metadata.translationGroupId, content.id]);
      content.translations = translationsResult.rows;
    }

    // Try to get live content from HCL DX if available
    if (content.dx_content_id) {
      try {
        const dxContent = await dxService.getContent(content.dx_content_id);
        content.dxContent = dxContent;
      } catch (dxError) {
        logger.warn('Could not fetch DX content:', dxError.message);
      }
    }

    res.json(content);
  } catch (error) {
    logger.error('Error fetching content:', error);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

/**
 * GET /api/microsite/assets
 * Get all published DAM assets for the microsite
 */
router.get('/assets', async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(`
      SELECT sa.*, u.username as uploaded_by_username, u.display_name as uploaded_by_name
      FROM staged_assets sa
      LEFT JOIN users u ON sa.uploaded_by = u.id
      WHERE sa.status = 'published'
      ORDER BY sa.published_at DESC NULLS LAST, sa.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const countResult = await db.query(
      `SELECT COUNT(*) FROM staged_assets WHERE status = 'published'`
    );

    res.json({
      assets: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching microsite assets:', error);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

/**
 * GET /api/microsite/assets/:id
 * Get single published asset
 */
router.get('/assets/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT sa.*, u.username as uploaded_by_username, u.display_name as uploaded_by_name
      FROM staged_assets sa
      LEFT JOIN users u ON sa.uploaded_by = u.id
      WHERE sa.id = $1 AND sa.status = 'published'
    `, [req.params.id]);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching asset:', error);
    res.status(500).json({ error: 'Failed to fetch asset' });
  }
});

/**
 * GET /api/microsite/dx/content
 * Fetch content directly from HCL DX WCM API
 */
router.get('/dx/content', async (req, res) => {
  try {
    const { library, contentType, limit = 20 } = req.query;
    
    // This proxies to HCL DX to get live content
    const content = await dxService.getLibraries();
    
    res.json({
      source: 'hcl-dx',
      content
    });
  } catch (error) {
    logger.error('Error fetching DX content:', error);
    res.status(500).json({ error: 'Failed to fetch content from HCL DX' });
  }
});

/**
 * GET /api/microsite/dx/render/:contentId
 * Render content from HCL DX using headless API
 */
router.get('/dx/render/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    const { presentationTemplate } = req.query;

    const preview = await dxService.getContentPreview(contentId, presentationTemplate);
    
    res.json({
      source: 'hcl-dx',
      render: preview
    });
  } catch (error) {
    logger.error('Error rendering DX content:', error);
    res.status(500).json({ error: 'Failed to render content from HCL DX' });
  }
});

/**
 * GET /api/microsite/languages
 * Get supported languages
 */
router.get('/languages', (req, res) => {
  res.json({
    languages: [
      { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' },
      { code: 'hi', name: 'Hindi', nativeName: 'हिंदी', dir: 'ltr' },
      { code: 'mr', name: 'Marathi', nativeName: 'मराठी', dir: 'ltr' }
    ],
    default: 'en'
  });
});

module.exports = router;
