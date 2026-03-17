/**
 * Authentication Middleware
 * Handles JWT validation and LTPA2 SSO token verification
 */

const jwt = require('jsonwebtoken');
const db = require('../config/database');
const ltpaService = require('../services/ltpaService');
const roleService = require('../services/roleService');
const logger = require('../config/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret';

/**
 * Verify JWT token and attach user to request
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Check for JWT in Authorization header
    const authHeader = req.headers.authorization;
    let token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    // Also check for token in cookies
    if (!token && req.cookies && req.cookies.authToken) {
      token = req.cookies.authToken;
    }

    // Try LTPA2 SSO if no JWT and LTPA2 is enabled
    if (!token && ltpaService.isEnabled()) {
      const ltpaToken = ltpaService.extractTokenFromRequest(req);
      if (ltpaToken) {
        const ltpaUser = await ltpaService.validateToken(ltpaToken);
        if (ltpaUser) {
          // Find or create user from LTPA data
          const userResult = await db.query(
            'SELECT * FROM users WHERE username = $1',
            [ltpaUser.username]
          );
          
          if (userResult.rows[0]) {
            req.user = userResult.rows[0];
            req.user.roles = await roleService.getUserRoles(ltpaUser.groups);
            return next();
          }
        }
      }
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch user from database
    const userResult = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!userResult.rows[0]) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = userResult.rows[0];
    req.user.roles = await roleService.getUserRoles(req.user.ldap_groups || []);
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    logger.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Optional authentication - continues even if not authenticated
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token && req.cookies && req.cookies.authToken) {
      token = req.cookies.authToken;
    }

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const userResult = await db.query(
        'SELECT * FROM users WHERE id = $1',
        [decoded.userId]
      );
      if (userResult.rows[0]) {
        req.user = userResult.rows[0];
        req.user.roles = await roleService.getUserRoles(req.user.ldap_groups || []);
      }
    }
  } catch (error) {
    // Continue without authentication
  }
  next();
};

/**
 * Role-based authorization middleware
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRoles = req.user.roles || [];
    const hasRole = allowedRoles.some(role => userRoles.includes(role));

    if (!hasRole) {
      logger.warn(`Access denied for user ${req.user.username}. Required roles: ${allowedRoles.join(', ')}`);
      return res.status(403).json({ 
        error: 'Access denied',
        message: `Required role: ${allowedRoles.join(' or ')}`
      });
    }

    next();
  };
};

/**
 * Check if user is admin (wpsadmin role)
 */
const requireAdmin = requireRole('wpsadmin');

/**
 * Check if user can author content
 * For local LDAP mode, also check direct group membership
 */
const requireAuthor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userRoles = req.user.roles || [];
  const ldapGroups = req.user.ldap_groups || [];
  
  // Check app roles
  const hasRole = userRoles.includes('dxcontentauthors') || userRoles.includes('wpsadmin');
  
  // Also check direct LDAP group membership for local mode
  const hasGroup = ldapGroups.some(g => 
    g.toLowerCase().includes('authors') || 
    g.toLowerCase().includes('admins') ||
    g.toLowerCase().includes('publishers') ||
    g.toLowerCase().includes('allusers')
  );

  if (!hasRole && !hasGroup) {
    logger.warn(`Author access denied for ${req.user.username}. Roles: ${userRoles.join(', ')}, Groups: ${ldapGroups.join(', ')}`);
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'Author role required'
    });
  }

  next();
};

/**
 * Check if user can approve content
 * For local LDAP mode, also check direct group membership
 */
const requireApprover = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userRoles = req.user.roles || [];
  const ldapGroups = req.user.ldap_groups || [];
  
  // Check app roles
  const hasRole = userRoles.includes('dxcontentapprovers') || userRoles.includes('wpsadmin');
  
  // Also check direct LDAP group membership for local mode
  const hasGroup = ldapGroups.some(g => 
    g.toLowerCase().includes('reviewers') || 
    g.toLowerCase().includes('admins')
  );

  if (!hasRole && !hasGroup) {
    logger.warn(`Approver access denied for ${req.user.username}. Roles: ${userRoles.join(', ')}, Groups: ${ldapGroups.join(', ')}`);
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'Approver role required'
    });
  }

  next();
};

/**
 * Generate JWT token for user
 */
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id,
      username: user.username 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole,
  requireAdmin,
  requireAuthor,
  requireApprover,
  generateToken
};
