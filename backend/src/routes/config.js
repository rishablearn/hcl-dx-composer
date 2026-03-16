/**
 * Configuration Routes
 * Handles system configuration and LDAP group role mappings
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const roleService = require('../services/roleService');
const ldapService = require('../services/ldapService');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const logger = require('../config/logger');

// ===========================================================================
// Role Mapping Routes
// ===========================================================================

/**
 * GET /api/config/role-mappings
 * Get all role mappings (Admin only)
 */
router.get('/role-mappings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const mappings = await roleService.getAllMappings();
    res.json(mappings);
  } catch (error) {
    logger.error('Error fetching role mappings:', error);
    res.status(500).json({ error: 'Failed to fetch role mappings' });
  }
});

/**
 * GET /api/config/role-mappings/:role
 * Get mappings for a specific application role
 */
router.get('/role-mappings/:role', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const validRoles = roleService.getValidRoles();
    if (!validRoles.includes(req.params.role)) {
      return res.status(400).json({ 
        error: 'Invalid role',
        validRoles 
      });
    }

    const mappings = await roleService.getMappingsForRole(req.params.role);
    res.json(mappings);
  } catch (error) {
    logger.error('Error fetching role mappings:', error);
    res.status(500).json({ error: 'Failed to fetch role mappings' });
  }
});

/**
 * POST /api/config/role-mappings
 * Create or update a role mapping (Admin only)
 */
router.post('/role-mappings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ldapGroupDn, ldapGroupName, appRole } = req.body;

    if (!ldapGroupDn || !ldapGroupName || !appRole) {
      return res.status(400).json({ 
        error: 'ldapGroupDn, ldapGroupName, and appRole are required' 
      });
    }

    const validRoles = roleService.getValidRoles();
    if (!validRoles.includes(appRole)) {
      return res.status(400).json({ 
        error: 'Invalid role',
        validRoles 
      });
    }

    const mapping = await roleService.createMapping(
      ldapGroupDn, 
      ldapGroupName, 
      appRole, 
      req.user.id
    );

    res.status(201).json(mapping);
  } catch (error) {
    logger.error('Error creating role mapping:', error);
    res.status(500).json({ error: 'Failed to create role mapping' });
  }
});

/**
 * DELETE /api/config/role-mappings/:id
 * Delete a role mapping (Admin only)
 */
router.delete('/role-mappings/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const deleted = await roleService.deleteMapping(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Role mapping not found' });
    }

    res.json({ success: true, message: 'Role mapping deleted' });
  } catch (error) {
    logger.error('Error deleting role mapping:', error);
    res.status(500).json({ error: 'Failed to delete role mapping' });
  }
});

/**
 * GET /api/config/roles
 * Get list of valid application roles
 */
router.get('/roles', authenticateToken, (req, res) => {
  res.json({
    roles: [
      { id: 'dxcontentauthors', name: 'Content Authors', description: 'Can create and edit content' },
      { id: 'dxcontentapprovers', name: 'Content Approvers', description: 'Can review and approve content' },
      { id: 'wpsadmin', name: 'Administrators', description: 'Full administrative access' }
    ]
  });
});

// ===========================================================================
// LDAP Groups Routes
// ===========================================================================

/**
 * GET /api/config/ldap-groups
 * Search LDAP groups (Admin only)
 */
router.get('/ldap-groups', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { filter } = req.query;
    const groups = await ldapService.getGroups(filter || '');
    res.json(groups);
  } catch (error) {
    logger.error('Error fetching LDAP groups:', error);
    res.status(500).json({ error: 'Failed to fetch LDAP groups' });
  }
});

// ===========================================================================
// System Configuration Routes
// ===========================================================================

/**
 * GET /api/config/system
 * Get all system configuration (Admin only)
 */
router.get('/system', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM system_config ORDER BY config_key');
    
    const config = {};
    result.rows.forEach(row => {
      config[row.config_key] = row.config_value;
    });

    res.json(config);
  } catch (error) {
    logger.error('Error fetching system config:', error);
    res.status(500).json({ error: 'Failed to fetch system configuration' });
  }
});

/**
 * GET /api/config/system/:key
 * Get specific configuration value
 */
router.get('/system/:key', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM system_config WHERE config_key = $1',
      [req.params.key]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching system config:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

/**
 * PUT /api/config/system/:key
 * Update system configuration (Admin only)
 */
router.put('/system/:key', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { value, description } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'Configuration value is required' });
    }

    const result = await db.query(`
      INSERT INTO system_config (config_key, config_value, description, updated_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (config_key) DO UPDATE SET
        config_value = EXCLUDED.config_value,
        description = COALESCE(EXCLUDED.description, system_config.description),
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      RETURNING *
    `, [req.params.key, JSON.stringify(value), description, req.user.id]);

    logger.info(`System config updated: ${req.params.key} by ${req.user.username}`);

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating system config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// ===========================================================================
// DX Connection Test
// ===========================================================================

/**
 * GET /api/config/dx-connection
 * Test HCL DX connection
 */
router.get('/dx-connection', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const dxHost = process.env.HCL_DX_HOST;
    const dxPort = process.env.HCL_DX_PORT;
    const dxProtocol = process.env.HCL_DX_PROTOCOL;

    if (!dxHost) {
      return res.json({
        connected: false,
        message: 'HCL DX host not configured'
      });
    }

    // Simple connectivity check
    const axios = require('axios');
    try {
      const response = await axios.get(`${dxProtocol}://${dxHost}:${dxPort}/wps/portal`, {
        timeout: 5000,
        validateStatus: () => true
      });

      res.json({
        connected: response.status < 500,
        status: response.status,
        host: dxHost,
        port: dxPort,
        protocol: dxProtocol
      });
    } catch (connError) {
      res.json({
        connected: false,
        message: connError.message,
        host: dxHost
      });
    }
  } catch (error) {
    logger.error('Error testing DX connection:', error);
    res.status(500).json({ error: 'Failed to test DX connection' });
  }
});

module.exports = router;
