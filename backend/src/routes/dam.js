/**
 * DAM Workflow Routes
 * Handles asset staging, approval workflow, and HCL DX DAM sync
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Load sharp safely - make it optional
let sharp = null;
try {
  sharp = require('sharp');
  console.log('Sharp loaded successfully');
} catch (err) {
  console.warn('Sharp not available - thumbnails will be disabled:', err.message);
}
const db = require('../config/database');
const dxService = require('../services/dxService');
const { authenticateToken, requireAuthor, requireApprover } = require('../middleware/auth');
const { uploadSingle, uploadMultiple, UPLOAD_PATH } = require('../middleware/upload');
const logger = require('../config/logger');

/**
 * GET /api/dam/diagnostic
 * Check upload system health
 */
router.get('/diagnostic', async (req, res) => {
  const checks = {
    uploadPath: UPLOAD_PATH,
    uploadPathExists: false,
    uploadPathWritable: false,
    dbConnected: false,
    sharpWorking: false,
    error: null
  };

  try {
    // Check upload directory
    checks.uploadPathExists = fs.existsSync(UPLOAD_PATH);
    if (checks.uploadPathExists) {
      try {
        const testFile = path.join(UPLOAD_PATH, '.write-test');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        checks.uploadPathWritable = true;
      } catch (e) {
        checks.error = `Upload path not writable: ${e.message}`;
      }
    } else {
      try {
        fs.mkdirSync(UPLOAD_PATH, { recursive: true });
        checks.uploadPathExists = true;
        checks.uploadPathWritable = true;
      } catch (e) {
        checks.error = `Cannot create upload path: ${e.message}`;
      }
    }

    // Check database
    try {
      await db.query('SELECT 1');
      checks.dbConnected = true;
    } catch (e) {
      checks.error = `DB error: ${e.message}`;
    }

    // Check sharp
    if (sharp) {
      try {
        await sharp({ create: { width: 10, height: 10, channels: 3, background: 'red' } }).png().toBuffer();
        checks.sharpWorking = true;
      } catch (e) {
        checks.sharpWorking = false;
        checks.sharpError = e.message;
      }
    } else {
      checks.sharpWorking = false;
      checks.sharpError = 'Sharp not loaded - thumbnails disabled';
    }

    res.json(checks);
  } catch (error) {
    res.status(500).json({ ...checks, error: error.message });
  }
});

/**
 * GET /api/dam/assets
 * Get all staged assets with optional filtering
 */
router.get('/assets', authenticateToken, async (req, res) => {
  try {
    const { status, collection_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT sa.*, u.username as uploaded_by_username, u.display_name as uploaded_by_name,
             ac.name as collection_name,
             au.username as approved_by_username
      FROM staged_assets sa
      LEFT JOIN users u ON sa.uploaded_by = u.id
      LEFT JOIN users au ON sa.approved_by = au.id
      LEFT JOIN asset_collections ac ON sa.collection_id = ac.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND sa.status = $${params.length}`;
    }

    if (collection_id) {
      params.push(collection_id);
      query += ` AND sa.collection_id = $${params.length}`;
    }

    query += ` ORDER BY sa.created_at DESC`;
    
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM staged_assets WHERE 1=1';
    const countParams = [];
    if (status) {
      countParams.push(status);
      countQuery += ` AND status = $${countParams.length}`;
    }
    if (collection_id) {
      countParams.push(collection_id);
      countQuery += ` AND collection_id = $${countParams.length}`;
    }
    const countResult = await db.query(countQuery, countParams);

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
    logger.error('Error fetching assets:', error);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

/**
 * GET /api/dam/assets/:id
 * Get single asset details
 */
router.get('/assets/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT sa.*, u.username as uploaded_by_username, u.display_name as uploaded_by_name,
             ac.name as collection_name,
             au.username as approved_by_username
      FROM staged_assets sa
      LEFT JOIN users u ON sa.uploaded_by = u.id
      LEFT JOIN users au ON sa.approved_by = au.id
      LEFT JOIN asset_collections ac ON sa.collection_id = ac.id
      WHERE sa.id = $1
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
 * POST /api/dam/assets/upload
 * Upload single asset (Authors only)
 */
router.post('/assets/upload', authenticateToken, requireAuthor, uploadSingle, async (req, res) => {
  try {
    logger.info(`Upload request received. User: ${req.user?.username}, File: ${req.file?.originalname}`);
    
    if (!req.file) {
      logger.warn('Upload failed: No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!req.user || !req.user.id) {
      logger.error('Upload failed: No user ID in request');
      return res.status(401).json({ error: 'User not authenticated properly' });
    }

    const { collection_id, tags, metadata } = req.body;
    const file = req.file;
    
    logger.info(`Processing upload: ${file.originalname}, size: ${file.size}, type: ${file.mimetype}`);

    // Generate thumbnail for images (skip if sharp not available or fails)
    let thumbnailPath = null;
    if (sharp && file.mimetype.startsWith('image/') && !file.mimetype.includes('svg')) {
      try {
        const thumbDir = path.join(UPLOAD_PATH, 'thumbnails');
        if (!fs.existsSync(thumbDir)) {
          fs.mkdirSync(thumbDir, { recursive: true });
        }
        const thumbFilename = `thumb_${path.basename(file.filename)}`;
        const thumbFullPath = path.join(thumbDir, thumbFilename);
        
        await sharp(file.path)
          .resize(200, 200, { fit: 'cover' })
          .toFile(thumbFullPath);
        
        thumbnailPath = `/thumbnails/${thumbFilename}`;
        logger.debug(`Thumbnail created: ${thumbnailPath}`);
      } catch (thumbError) {
        logger.warn(`Thumbnail generation failed (continuing without): ${thumbError.message}`);
      }
    }

    // Store relative path from UPLOAD_PATH
    const relativePath = path.relative(UPLOAD_PATH, file.path);
    logger.debug(`File path: ${file.path}, relative: ${relativePath}`);

    // Parse metadata and tags safely
    let parsedMetadata = {};
    let parsedTags = [];
    try {
      if (metadata) parsedMetadata = JSON.parse(metadata);
      if (tags) parsedTags = JSON.parse(tags);
    } catch (parseErr) {
      logger.warn(`Failed to parse metadata/tags: ${parseErr.message}`);
    }

    const result = await db.query(`
      INSERT INTO staged_assets (
        filename, original_filename, mime_type, file_size, file_path, thumbnail_path,
        metadata, tags, status, collection_id, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9, $10)
      RETURNING *
    `, [
      file.filename,
      file.originalname,
      file.mimetype,
      file.size,
      '/' + relativePath,
      thumbnailPath,
      parsedMetadata,
      parsedTags,
      collection_id || null,
      req.user.id
    ]);

    // Record workflow history
    await db.query(`
      INSERT INTO workflow_history (entity_type, entity_id, action, to_status, performed_by)
      VALUES ('asset', $1, 'upload', 'draft', $2)
    `, [result.rows[0].id, req.user.id]);

    logger.info(`Asset uploaded successfully: ${file.originalname} by ${req.user.username}`);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error uploading asset:', error.message);
    logger.error('Stack:', error.stack);
    res.status(500).json({ error: 'Failed to upload asset', details: error.message });
  }
});

/**
 * POST /api/dam/assets/upload-multiple
 * Upload multiple assets (Authors only)
 */
router.post('/assets/upload-multiple', authenticateToken, requireAuthor, uploadMultiple, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const { collection_id, tags } = req.body;
    const uploadedAssets = [];

    for (const file of req.files) {
      // Generate thumbnail for images
      let thumbnailPath = null;
      if (file.mimetype.startsWith('image/') && !file.mimetype.includes('svg')) {
        try {
          const thumbDir = path.join(UPLOAD_PATH, 'thumbnails');
          if (!fs.existsSync(thumbDir)) {
            fs.mkdirSync(thumbDir, { recursive: true });
          }
          const thumbFilename = `thumb_${path.basename(file.filename)}`;
          thumbnailPath = path.join(thumbDir, thumbFilename);
          
          await sharp(file.path)
            .resize(200, 200, { fit: 'cover' })
            .toFile(thumbnailPath);
          
          thumbnailPath = `/thumbnails/${thumbFilename}`;
        } catch (thumbError) {
          logger.warn('Thumbnail generation failed:', thumbError.message);
        }
      }

      const relativePath = path.relative(UPLOAD_PATH, file.path);

      const result = await db.query(`
        INSERT INTO staged_assets (
          filename, original_filename, mime_type, file_size, file_path, thumbnail_path,
          tags, status, collection_id, uploaded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9)
        RETURNING *
      `, [
        file.filename,
        file.originalname,
        file.mimetype,
        file.size,
        '/' + relativePath,
        thumbnailPath,
        tags ? JSON.parse(tags) : [],
        collection_id || null,
        req.user.id
      ]);

      await db.query(`
        INSERT INTO workflow_history (entity_type, entity_id, action, to_status, performed_by)
        VALUES ('asset', $1, 'upload', 'draft', $2)
      `, [result.rows[0].id, req.user.id]);

      uploadedAssets.push(result.rows[0]);
    }

    logger.info(`${uploadedAssets.length} assets uploaded by ${req.user.username}`);

    res.status(201).json({ 
      success: true,
      count: uploadedAssets.length,
      assets: uploadedAssets 
    });
  } catch (error) {
    logger.error('Error uploading multiple assets:', error);
    res.status(500).json({ error: 'Failed to upload assets' });
  }
});

/**
 * POST /api/dam/assets/:id/submit
 * Submit asset for approval (Authors only)
 */
router.post('/assets/:id/submit', authenticateToken, requireAuthor, async (req, res) => {
  try {
    const result = await db.query(`
      UPDATE staged_assets 
      SET status = 'pending_approval', updated_at = NOW()
      WHERE id = $1 AND uploaded_by = $2 AND status = 'draft'
      RETURNING *
    `, [req.params.id, req.user.id]);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Asset not found or cannot be submitted' });
    }

    await db.query(`
      INSERT INTO workflow_history (entity_type, entity_id, action, from_status, to_status, performed_by)
      VALUES ('asset', $1, 'submit', 'draft', 'pending_approval', $2)
    `, [req.params.id, req.user.id]);

    logger.info(`Asset submitted for approval: ${req.params.id}`);

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error submitting asset:', error);
    res.status(500).json({ error: 'Failed to submit asset' });
  }
});

/**
 * POST /api/dam/assets/:id/approve
 * Approve asset and move from "Not Approved Assets" to "Approved Assets" in HCL DX DAM
 */
router.post('/assets/:id/approve', authenticateToken, requireApprover, async (req, res) => {
  try {
    // Get asset details first
    const assetQuery = await db.query(
      'SELECT * FROM staged_assets WHERE id = $1 AND status = $2',
      [req.params.id, 'pending_approval']
    );

    if (!assetQuery.rows[0]) {
      return res.status(404).json({ error: 'Asset not found or cannot be approved' });
    }

    const asset = assetQuery.rows[0];
    const authToken = req.user.ltpaToken || null;
    let dxMoveResult = null;

    // If asset exists in DX DAM "Not Approved Assets", move it to "Approved Assets"
    if (asset.dx_asset_id && asset.dx_collection_id) {
      try {
        const filePath = path.join(UPLOAD_PATH, asset.file_path.replace(/^\//, ''));
        dxMoveResult = await dxService.moveToApprovedCollection(
          asset.dx_asset_id,
          asset.dx_collection_id,
          filePath,
          asset.original_filename,
          asset.mime_type,
          {
            ...(asset.metadata || {}),
            approvedBy: req.user.username,
            approvedAt: new Date().toISOString()
          },
          authToken
        );
        logger.info(`Asset moved to Approved Assets collection in DX DAM: ${asset.dx_asset_id}`);
      } catch (dxError) {
        logger.warn(`Failed to move asset in DX DAM (continuing with local approval): ${dxError.message}`);
      }
    }

    // Update local database
    const result = await db.query(`
      UPDATE staged_assets 
      SET status = 'approved', 
          approved_by = $2, 
          approved_at = NOW(), 
          updated_at = NOW(),
          dx_asset_id = COALESCE($3, dx_asset_id),
          dx_collection_id = COALESCE($4, dx_collection_id),
          metadata = metadata || $5::jsonb
      WHERE id = $1
      RETURNING *
    `, [
      req.params.id, 
      req.user.id,
      dxMoveResult?.asset?.id || null,
      dxMoveResult?.collection?.id || null,
      JSON.stringify({
        dxCollectionName: dxMoveResult ? 'Approved Assets' : (asset.metadata?.dxCollectionName || null),
        movedToApprovedAt: dxMoveResult ? new Date().toISOString() : null
      })
    ]);

    await db.query(`
      INSERT INTO workflow_history (entity_type, entity_id, action, from_status, to_status, performed_by, metadata)
      VALUES ('asset', $1, 'approve', 'pending_approval', 'approved', $2, $3)
    `, [
      req.params.id, 
      req.user.id,
      JSON.stringify({
        dxMoved: !!dxMoveResult,
        fromCollection: 'Not Approved Assets',
        toCollection: 'Approved Assets',
        newDxAssetId: dxMoveResult?.asset?.id
      })
    ]);

    logger.info(`Asset approved and moved to Approved Assets: ${req.params.id} by ${req.user.username}`);

    res.json({
      ...result.rows[0],
      dxWorkflow: {
        moved: !!dxMoveResult,
        fromCollection: 'Not Approved Assets',
        toCollection: 'Approved Assets',
        newAssetId: dxMoveResult?.asset?.id
      }
    });
  } catch (error) {
    logger.error('Error approving asset:', error);
    res.status(500).json({ error: 'Failed to approve asset' });
  }
});

/**
 * POST /api/dam/assets/:id/reject
 * Reject asset (Approvers only)
 */
router.post('/assets/:id/reject', authenticateToken, requireApprover, async (req, res) => {
  try {
    const { reason } = req.body;

    const result = await db.query(`
      UPDATE staged_assets 
      SET status = 'rejected', rejection_reason = $2, updated_at = NOW()
      WHERE id = $1 AND status = 'pending_approval'
      RETURNING *
    `, [req.params.id, reason || 'No reason provided']);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Asset not found or cannot be rejected' });
    }

    await db.query(`
      INSERT INTO workflow_history (entity_type, entity_id, action, from_status, to_status, performed_by, comments)
      VALUES ('asset', $1, 'reject', 'pending_approval', 'rejected', $2, $3)
    `, [req.params.id, req.user.id, reason]);

    logger.info(`Asset rejected: ${req.params.id} by ${req.user.username}`);

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error rejecting asset:', error);
    res.status(500).json({ error: 'Failed to reject asset' });
  }
});

/**
 * POST /api/dam/assets/:id/publish
 * Publish approved asset to HCL DX DAM (or mark as published locally if DX not configured)
 */
router.post('/assets/:id/publish', authenticateToken, requireApprover, async (req, res) => {
  try {
    // Get asset details
    const assetResult = await db.query(
      'SELECT * FROM staged_assets WHERE id = $1 AND status = $2',
      [req.params.id, 'approved']
    );

    if (!assetResult.rows[0]) {
      return res.status(404).json({ error: 'Asset not found or not approved' });
    }

    const asset = assetResult.rows[0];
    const filePath = path.join(UPLOAD_PATH, asset.file_path.replace(/^\//, ''));

    // Check if HCL DX is configured
    if (!dxService.isConfigured()) {
      // DX not configured - just update local status
      const result = await db.query(`
        UPDATE staged_assets 
        SET status = 'published', 
            published_at = NOW(), 
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [req.params.id]);

      await db.query(`
        INSERT INTO workflow_history (entity_type, entity_id, action, from_status, to_status, performed_by, metadata)
        VALUES ('asset', $1, 'publish', 'approved', 'published', $2, $3)
      `, [req.params.id, req.user.id, JSON.stringify({ mode: 'local', note: 'HCL DX not configured' })]);

      logger.info(`Asset published locally (DX not configured): ${req.params.id}`);

      return res.json({
        success: true,
        asset: result.rows[0],
        dxAsset: null,
        message: 'Asset published locally. HCL DX integration not configured.'
      });
    }

    // HCL DX is configured - proceed with DX upload
    let dxCollectionId = asset.dx_collection_id;
    
    if (!dxCollectionId) {
      // Create a new collection with date stamp
      const now = new Date();
      const collectionName = `Approved_${now.getFullYear()}_${now.toLocaleString('default', { month: 'long' })}`;
      
      try {
        const dxCollection = await dxService.createCollection(
          collectionName,
          'Auto-created collection for approved assets',
          {
            approved: 'true',
            approvedDate: now.toISOString(),
            source: 'hcl-dx-composer'
          }
        );
        dxCollectionId = dxCollection.id;

        // Set access control
        await dxService.setCollectionAccessControl(dxCollectionId, {
          administrator: 'wpsadmin',
          user: 'Anonymous Portal User'
        });
      } catch (dxError) {
        logger.error('Failed to create DX collection:', dxError);
        // Fall back to local publish
        const result = await db.query(`
          UPDATE staged_assets 
          SET status = 'published', 
              published_at = NOW(), 
              updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `, [req.params.id]);

        await db.query(`
          INSERT INTO workflow_history (entity_type, entity_id, action, from_status, to_status, performed_by, metadata)
          VALUES ('asset', $1, 'publish', 'approved', 'published', $2, $3)
        `, [req.params.id, req.user.id, JSON.stringify({ mode: 'local', error: dxError.message })]);

        logger.warn(`Asset published locally (DX error): ${req.params.id}`);

        return res.json({
          success: true,
          asset: result.rows[0],
          dxAsset: null,
          message: 'Asset published locally. DX upload failed: ' + dxError.message
        });
      }
    }

    // Upload asset to DX
    try {
      const dxAsset = await dxService.uploadAsset(
        dxCollectionId,
        filePath,
        asset.original_filename,
        asset.mime_type,
        {
          ...asset.metadata,
          approved: 'true',
          approvedDate: new Date().toISOString(),
          tags: asset.tags
        }
      );

      // Update staged asset with DX references
      const result = await db.query(`
        UPDATE staged_assets 
        SET status = 'published', 
            published_at = NOW(), 
            dx_asset_id = $2, 
            dx_collection_id = $3,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [req.params.id, dxAsset.id, dxCollectionId]);

      await db.query(`
        INSERT INTO workflow_history (entity_type, entity_id, action, from_status, to_status, performed_by, metadata)
        VALUES ('asset', $1, 'publish', 'approved', 'published', $2, $3)
      `, [req.params.id, req.user.id, JSON.stringify({ dx_asset_id: dxAsset.id, dx_collection_id: dxCollectionId })]);

      logger.info(`Asset published to DX: ${req.params.id} -> ${dxAsset.id}`);

      res.json({
        success: true,
        asset: result.rows[0],
        dxAsset: {
          id: dxAsset.id,
          collectionId: dxCollectionId
        }
      });
    } catch (dxError) {
      logger.error('Failed to upload asset to DX:', dxError);
      // Fall back to local publish
      const result = await db.query(`
        UPDATE staged_assets 
        SET status = 'published', 
            published_at = NOW(), 
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [req.params.id]);

      await db.query(`
        INSERT INTO workflow_history (entity_type, entity_id, action, from_status, to_status, performed_by, metadata)
        VALUES ('asset', $1, 'publish', 'approved', 'published', $2, $3)
      `, [req.params.id, req.user.id, JSON.stringify({ mode: 'local', error: dxError.message })]);

      return res.json({
        success: true,
        asset: result.rows[0],
        dxAsset: null,
        message: 'Asset published locally. DX upload failed: ' + dxError.message
      });
    }
  } catch (error) {
    logger.error('Error publishing asset:', error);
    res.status(500).json({ error: 'Failed to publish asset' });
  }
});

/**
 * DELETE /api/dam/assets/:id
 * Delete staged asset
 */
router.delete('/assets/:id', authenticateToken, async (req, res) => {
  try {
    // Only allow deletion of own assets or if admin
    const roles = req.user.roles || [];
    const isAdmin = roles.includes('wpsadmin');

    let query = 'DELETE FROM staged_assets WHERE id = $1';
    const params = [req.params.id];

    if (!isAdmin) {
      query += ' AND uploaded_by = $2';
      params.push(req.user.id);
    }

    query += ' RETURNING *';
    const result = await db.query(query, params);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Asset not found or access denied' });
    }

    // Delete physical file
    const filePath = path.join(UPLOAD_PATH, result.rows[0].file_path.replace(/^\//, ''));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete thumbnail if exists
    if (result.rows[0].thumbnail_path) {
      const thumbPath = path.join(UPLOAD_PATH, result.rows[0].thumbnail_path.replace(/^\//, ''));
      if (fs.existsSync(thumbPath)) {
        fs.unlinkSync(thumbPath);
      }
    }

    logger.info(`Asset deleted: ${req.params.id} by ${req.user.username}`);

    res.json({ success: true, message: 'Asset deleted' });
  } catch (error) {
    logger.error('Error deleting asset:', error);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

// ===========================================================================
// Collection Routes
// ===========================================================================

/**
 * GET /api/dam/collections
 * Get all collections
 */
router.get('/collections', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT ac.*, u.username as created_by_username, u.display_name as created_by_name,
             COUNT(sa.id) as asset_count
      FROM asset_collections ac
      LEFT JOIN users u ON ac.created_by = u.id
      LEFT JOIN staged_assets sa ON sa.collection_id = ac.id
      GROUP BY ac.id, u.username, u.display_name
      ORDER BY ac.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching collections:', error);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

/**
 * POST /api/dam/collections
 * Create new collection
 */
router.post('/collections', authenticateToken, requireAuthor, async (req, res) => {
  try {
    const { name, description, metadata } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Collection name is required' });
    }

    const result = await db.query(`
      INSERT INTO asset_collections (name, description, metadata, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [name, description || '', metadata || {}, req.user.id]);

    logger.info(`Collection created: ${name} by ${req.user.username}`);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error creating collection:', error);
    res.status(500).json({ error: 'Failed to create collection' });
  }
});

/**
 * GET /api/dam/workflow-stats
 * Get workflow statistics for dashboard
 */
router.get('/workflow-stats', authenticateToken, async (req, res) => {
  try {
    const statsResult = await db.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM staged_assets
      GROUP BY status
    `);

    const recentResult = await db.query(`
      SELECT wh.*, sa.original_filename, u.username, u.display_name
      FROM workflow_history wh
      JOIN staged_assets sa ON wh.entity_id = sa.id AND wh.entity_type = 'asset'
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
    logger.error('Error fetching workflow stats:', error);
    res.status(500).json({ error: 'Failed to fetch workflow statistics' });
  }
});

module.exports = router;
