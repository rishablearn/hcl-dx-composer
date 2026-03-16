/**
 * LTPA2 Token Service - Handles SSO token validation with HCL DX Portal
 */

const crypto = require('crypto');
const logger = require('../config/logger');

class LtpaService {
  constructor() {
    this.secretKey = process.env.LTPA2_SECRET_KEY;
    this.realm = process.env.LTPA2_REALM || 'defaultWIMFileBasedRealm';
  }

  /**
   * Validate LTPA2 token
   */
  async validateToken(token) {
    if (!this.secretKey) {
      logger.warn('LTPA2 secret key not configured');
      return null;
    }

    try {
      // Decode the base64 token
      const decodedToken = Buffer.from(token, 'base64');
      
      // LTPA2 token structure:
      // - Version (4 bytes)
      // - Creation time (8 bytes)
      // - Expiration time (8 bytes)
      // - User data (variable)
      // - Signature (remaining bytes)
      
      const version = decodedToken.slice(0, 4).toString('hex');
      const creationTime = this.readTimestamp(decodedToken.slice(4, 12));
      const expirationTime = this.readTimestamp(decodedToken.slice(12, 20));
      
      // Check if token is expired
      const now = Date.now();
      if (now > expirationTime) {
        logger.warn('LTPA2 token expired');
        return null;
      }

      // Find the user data (between header and signature)
      // The signature is typically the last 20 bytes (SHA-1 HMAC)
      const signatureLength = 20;
      const userData = decodedToken.slice(20, -signatureLength);
      const signature = decodedToken.slice(-signatureLength);

      // Verify signature
      const dataToSign = decodedToken.slice(0, -signatureLength);
      const secretKeyBuffer = Buffer.from(this.secretKey, 'base64');
      const expectedSignature = crypto
        .createHmac('sha1', secretKeyBuffer)
        .update(dataToSign)
        .digest();

      if (!crypto.timingSafeEqual(signature, expectedSignature)) {
        logger.warn('LTPA2 token signature verification failed');
        return null;
      }

      // Parse user data
      const userDataString = userData.toString('utf8');
      const userInfo = this.parseUserData(userDataString);

      logger.info(`LTPA2 token validated for user: ${userInfo.username}`);
      
      return {
        valid: true,
        username: userInfo.username,
        realm: userInfo.realm,
        groups: userInfo.groups,
        createdAt: new Date(creationTime),
        expiresAt: new Date(expirationTime)
      };
    } catch (error) {
      logger.error('LTPA2 token validation error:', error);
      return null;
    }
  }

  /**
   * Read timestamp from LTPA2 token bytes
   */
  readTimestamp(buffer) {
    // LTPA2 uses milliseconds since epoch
    return buffer.readBigInt64BE ? 
      Number(buffer.readBigInt64BE(0)) : 
      parseInt(buffer.toString('hex'), 16);
  }

  /**
   * Parse user data from LTPA2 token
   */
  parseUserData(dataString) {
    // LTPA2 user data format: u:realm/username%groupDN1%groupDN2...
    const parts = dataString.split('%');
    const userPart = parts[0];
    const groups = parts.slice(1).filter(g => g.length > 0);

    let username = userPart;
    let realm = this.realm;

    // Parse u:realm/username format
    if (userPart.startsWith('u:')) {
      const userInfo = userPart.substring(2);
      const slashIndex = userInfo.indexOf('/');
      if (slashIndex > 0) {
        realm = userInfo.substring(0, slashIndex);
        username = userInfo.substring(slashIndex + 1);
      } else {
        username = userInfo;
      }
    }

    return { username, realm, groups };
  }

  /**
   * Extract LTPA2 token from request
   */
  extractTokenFromRequest(req) {
    // Check for LtpaToken2 cookie
    if (req.cookies && req.cookies.LtpaToken2) {
      return req.cookies.LtpaToken2;
    }

    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('LTPA ')) {
      return authHeader.substring(5);
    }

    return null;
  }

  /**
   * Check if LTPA2 SSO is enabled
   */
  isEnabled() {
    return !!this.secretKey;
  }
}

module.exports = new LtpaService();
