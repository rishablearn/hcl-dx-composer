/**
 * Authentication Routes
 * Handles LDAP authentication, session management, and user info
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const ldapService = require('../services/ldapService');
const roleService = require('../services/roleService');
const ltpaService = require('../services/ltpaService');
const { authenticateToken, generateToken } = require('../middleware/auth');
const logger = require('../config/logger');

/**
 * POST /api/auth/login
 * Authenticate user with LDAP credentials
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Authenticate with LDAP
    const ldapUser = await ldapService.authenticate(username, password);

    // Get application roles based on LDAP groups
    const roles = await roleService.getUserRoles(ldapUser.memberOf);

    // Create or update user in database
    const userResult = await db.query(`
      INSERT INTO users (ldap_dn, username, email, display_name, ldap_groups, roles, last_login)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (username) DO UPDATE SET
        ldap_dn = EXCLUDED.ldap_dn,
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        ldap_groups = EXCLUDED.ldap_groups,
        roles = EXCLUDED.roles,
        last_login = NOW(),
        updated_at = NOW()
      RETURNING *
    `, [
      ldapUser.dn,
      ldapUser.username,
      ldapUser.email,
      ldapUser.displayName,
      ldapUser.memberOf,
      roles
    ]);

    const user = userResult.rows[0];
    const token = generateToken(user);

    logger.info(`User logged in: ${username}`);

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        roles
      },
      token
    });
  } catch (error) {
    logger.error('Login error:', error.message);
    res.status(401).json({ error: error.message || 'Authentication failed' });
  }
});

/**
 * POST /api/auth/logout
 * Logout user and invalidate session
 */
router.post('/logout', authenticateToken, (req, res) => {
  logger.info(`User logged out: ${req.user.username}`);
  res.clearCookie('authToken');
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * GET /api/auth/me
 * Get current authenticated user info
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const roles = await roleService.getUserRoles(req.user.ldap_groups || []);
    
    res.json({
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      displayName: req.user.display_name,
      roles,
      lastLogin: req.user.last_login
    });
  } catch (error) {
    logger.error('Error fetching user info:', error);
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

/**
 * GET /api/auth/validate
 * Validate current token
 */
router.get('/validate', authenticateToken, (req, res) => {
  res.json({ valid: true, userId: req.user.id });
});

/**
 * POST /api/auth/sso/validate
 * Validate LTPA2 SSO token
 */
router.post('/sso/validate', async (req, res) => {
  try {
    if (!ltpaService.isEnabled()) {
      return res.status(400).json({ error: 'SSO is not configured' });
    }

    const ltpaToken = ltpaService.extractTokenFromRequest(req);
    if (!ltpaToken) {
      return res.status(400).json({ error: 'No LTPA token provided' });
    }

    const tokenInfo = await ltpaService.validateToken(ltpaToken);
    if (!tokenInfo || !tokenInfo.valid) {
      return res.status(401).json({ error: 'Invalid LTPA token' });
    }

    // Get or create user
    let userResult = await db.query(
      'SELECT * FROM users WHERE username = $1',
      [tokenInfo.username]
    );

    if (!userResult.rows[0]) {
      // Create user from LTPA info
      const roles = await roleService.getUserRoles(tokenInfo.groups);
      userResult = await db.query(`
        INSERT INTO users (ldap_dn, username, ldap_groups, roles, last_login)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `, [
        tokenInfo.username,
        tokenInfo.username,
        tokenInfo.groups,
        roles
      ]);
    }

    const user = userResult.rows[0];
    const token = generateToken(user);
    const roles = await roleService.getUserRoles(user.ldap_groups || []);

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        roles
      },
      token,
      sso: {
        realm: tokenInfo.realm,
        expiresAt: tokenInfo.expiresAt
      }
    });
  } catch (error) {
    logger.error('SSO validation error:', error);
    res.status(500).json({ error: 'SSO validation failed' });
  }
});

/**
 * GET /api/auth/ldap/groups
 * Get available LDAP groups (admin only)
 */
router.get('/ldap/groups', authenticateToken, async (req, res) => {
  try {
    const roles = await roleService.getUserRoles(req.user.ldap_groups || []);
    if (!roles.includes('wpsadmin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const filter = req.query.filter || '';
    const groups = await ldapService.getGroups(filter);
    
    res.json({ groups });
  } catch (error) {
    logger.error('Error fetching LDAP groups:', error);
    res.status(500).json({ error: 'Failed to fetch LDAP groups' });
  }
});

module.exports = router;
