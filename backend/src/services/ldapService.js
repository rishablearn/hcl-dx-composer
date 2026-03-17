/**
 * LDAP Service - Handles Active Directory/OpenLDAP authentication and group membership
 * Supports both Local OpenLDAP (Docker) and External AD/LDAP servers
 */

const ldap = require('ldapjs');
const logger = require('../config/logger');

class LdapService {
  constructor() {
    this.url = process.env.LDAP_URL;
    this.baseDN = process.env.LDAP_BASE_DN;
    this.bindDN = process.env.LDAP_BIND_DN;
    this.bindPassword = process.env.LDAP_BIND_PASSWORD;
    this.userSearchBase = process.env.LDAP_USER_SEARCH_BASE || this.baseDN;
    this.groupSearchBase = process.env.LDAP_GROUP_SEARCH_BASE || this.baseDN;
    this.ldapMode = process.env.LDAP_MODE || 'local';
    
    // Validate configuration on startup
    this.validateConfig();
  }

  /**
   * Validate LDAP configuration
   */
  validateConfig() {
    const missing = [];
    if (!this.url) missing.push('LDAP_URL');
    if (!this.baseDN) missing.push('LDAP_BASE_DN');
    if (!this.bindDN) missing.push('LDAP_BIND_DN');
    if (!this.bindPassword) missing.push('LDAP_BIND_PASSWORD');
    
    if (missing.length > 0) {
      logger.warn(`LDAP configuration incomplete. Missing: ${missing.join(', ')}`);
      logger.warn('LDAP authentication will not work until configured.');
    } else {
      logger.info(`LDAP configured: ${this.url} (mode: ${this.ldapMode})`);
    }
  }

  /**
   * Check if LDAP is properly configured
   */
  isConfigured() {
    return this.url && this.baseDN && this.bindDN && this.bindPassword;
  }

  /**
   * Create a new LDAP client connection with error handling
   */
  createClient() {
    if (!this.isConfigured()) {
      throw new Error('LDAP is not configured. Check environment variables.');
    }
    
    const client = ldap.createClient({
      url: this.url,
      timeout: 10000,
      connectTimeout: 10000,
      reconnect: {
        initialDelay: 100,
        maxDelay: 500,
        failAfter: 3
      }
    });
    
    return client;
  }

  /**
   * Test LDAP connection
   */
  async testConnection() {
    return new Promise((resolve, reject) => {
      if (!this.isConfigured()) {
        return reject(new Error('LDAP not configured'));
      }
      
      try {
        const client = this.createClient();
        
        client.on('error', (err) => {
          logger.error('LDAP connection test failed:', err);
          reject(new Error(`LDAP connection failed: ${err.message}`));
        });
        
        client.bind(this.bindDN, this.bindPassword, (err) => {
          if (err) {
            client.unbind();
            logger.error('LDAP bind test failed:', err);
            return reject(new Error(`LDAP bind failed: ${err.message}`));
          }
          
          client.unbind();
          logger.info('LDAP connection test successful');
          resolve({ status: 'connected', url: this.url });
        });
      } catch (err) {
        reject(new Error(`LDAP connection error: ${err.message}`));
      }
    });
  }

  /**
   * Authenticate user with LDAP credentials
   */
  async authenticate(username, password) {
    // Check configuration first
    if (!this.isConfigured()) {
      logger.error('LDAP authentication attempted but LDAP is not configured');
      throw new Error('LDAP is not configured. Please configure LDAP settings.');
    }
    
    // Validate inputs
    if (!username || !password) {
      throw new Error('Username and password are required');
    }
    
    return new Promise((resolve, reject) => {
      let client;
      try {
        client = this.createClient();
      } catch (err) {
        return reject(err);
      }
      
      let userDN = null;
      let userData = null;
      let connectionError = false;

      client.on('error', (err) => {
        connectionError = true;
        logger.error('LDAP client error:', err);
        if (err.code === 'ECONNREFUSED') {
          reject(new Error('Cannot connect to LDAP server. Is the LDAP container running?'));
        } else if (err.code === 'ETIMEDOUT') {
          reject(new Error('LDAP connection timed out. Check network connectivity.'));
        } else {
          reject(new Error(`LDAP connection error: ${err.message}`));
        }
      });
      
      client.on('connectError', (err) => {
        connectionError = true;
        logger.error('LDAP connect error:', err);
        reject(new Error('Failed to connect to LDAP server'));
      });

      // First, bind with service account to search for user
      client.bind(this.bindDN, this.bindPassword, (bindErr) => {
        if (bindErr) {
          client.unbind();
          logger.error('LDAP service bind failed:', bindErr);
          return reject(new Error('LDAP service authentication failed'));
        }

        // Search for the user - simplified filter for OpenLDAP compatibility
        // Using uid and cn which work with both OpenLDAP and AD
        const searchFilter = `(|(uid=${username})(cn=${username})(mail=${username}))`;
        const searchOptions = {
          filter: searchFilter,
          scope: 'sub',
          attributes: ['dn', 'uid', 'mail', 'displayName', 'memberOf', 'cn', 'givenName', 'sn']
        };
        
        logger.debug(`LDAP search filter: ${searchFilter}`);
        logger.debug(`LDAP search base: ${this.userSearchBase}`);

        client.search(this.userSearchBase, searchOptions, (searchErr, searchRes) => {
          if (searchErr) {
            client.unbind();
            logger.error('LDAP search error:', searchErr);
            logger.error('Search base may not exist. Run: ./scripts/populate-ldap.sh');
            return reject(new Error('User search failed - LDAP not initialized. Run ./scripts/populate-ldap.sh'));
          }

          searchRes.on('searchEntry', (entry) => {
            userDN = entry.objectName;
            logger.debug(`Found user DN: ${userDN}`);
            userData = {
              dn: entry.objectName,
              username: entry.attributes.find(a => a.type === 'uid')?.values[0] ||
                        entry.attributes.find(a => a.type === 'cn')?.values[0] || 
                        username,
              email: entry.attributes.find(a => a.type === 'mail')?.values[0],
              displayName: entry.attributes.find(a => a.type === 'displayName')?.values[0] ||
                          entry.attributes.find(a => a.type === 'cn')?.values[0],
              memberOf: entry.attributes.find(a => a.type === 'memberOf')?.values || []
            };
            logger.debug(`User data: ${JSON.stringify(userData)}`);
          });

          searchRes.on('error', (err) => {
            client.unbind();
            logger.error('LDAP search result error:', err);
            
            // Provide helpful error messages based on error type
            if (err.lde_message === 'No Such Object') {
              logger.error('LDAP search base does not exist. Users not initialized.');
              logger.error('Run: ./scripts/populate-ldap.sh to create LDAP users');
              reject(new Error('LDAP not initialized. Run ./scripts/populate-ldap.sh to create users.'));
            } else if (err.code === 32) {
              reject(new Error('LDAP directory structure missing. Initialize with populate-ldap.sh'));
            } else {
              reject(new Error(`LDAP search failed: ${err.message || err.lde_message || 'Unknown error'}`));
            }
          });

          searchRes.on('end', () => {
            if (!userDN) {
              client.unbind();
              logger.warn(`User not found in LDAP: ${username}`);
              return reject(new Error('User not found. Check username or run ./scripts/populate-ldap.sh'));
            }

            // Authenticate the user with their credentials
            client.bind(userDN, password, (authErr) => {
              client.unbind();
              
              if (authErr) {
                logger.warn(`Authentication failed for user: ${username}`);
                return reject(new Error('Invalid credentials'));
              }

              logger.info(`User authenticated successfully: ${username}`);
              resolve(userData);
            });
          });
        });
      });
    });
  }

  /**
   * Get all available LDAP groups
   */
  async getGroups(filter = '') {
    return new Promise((resolve, reject) => {
      const client = this.createClient();

      client.on('error', (err) => {
        logger.error('LDAP client error:', err);
        reject(new Error('LDAP connection error'));
      });

      client.bind(this.bindDN, this.bindPassword, (bindErr) => {
        if (bindErr) {
          client.unbind();
          logger.error('LDAP service bind failed:', bindErr);
          return reject(new Error('LDAP service authentication failed'));
        }

        const searchFilter = filter 
          ? `(&(objectClass=group)(cn=*${filter}*))` 
          : '(objectClass=group)';
        
        const searchOptions = {
          filter: searchFilter,
          scope: 'sub',
          attributes: ['dn', 'cn', 'description', 'member'],
          sizeLimit: 100
        };

        const groups = [];

        client.search(this.groupSearchBase, searchOptions, (searchErr, searchRes) => {
          if (searchErr) {
            client.unbind();
            logger.error('LDAP group search error:', searchErr);
            return reject(new Error('Group search failed'));
          }

          searchRes.on('searchEntry', (entry) => {
            groups.push({
              dn: entry.objectName,
              name: entry.attributes.find(a => a.type === 'cn')?.values[0],
              description: entry.attributes.find(a => a.type === 'description')?.values[0] || '',
              memberCount: (entry.attributes.find(a => a.type === 'member')?.values || []).length
            });
          });

          searchRes.on('error', (err) => {
            client.unbind();
            logger.error('LDAP group search result error:', err);
            reject(new Error('Group search failed'));
          });

          searchRes.on('end', () => {
            client.unbind();
            resolve(groups);
          });
        });
      });
    });
  }

  /**
   * Get user's group memberships
   */
  async getUserGroups(userDN) {
    return new Promise((resolve, reject) => {
      const client = this.createClient();

      client.on('error', (err) => {
        logger.error('LDAP client error:', err);
        reject(new Error('LDAP connection error'));
      });

      client.bind(this.bindDN, this.bindPassword, (bindErr) => {
        if (bindErr) {
          client.unbind();
          return reject(new Error('LDAP service authentication failed'));
        }

        const searchOptions = {
          filter: `(member=${userDN})`,
          scope: 'sub',
          attributes: ['dn', 'cn']
        };

        const groups = [];

        client.search(this.groupSearchBase, searchOptions, (searchErr, searchRes) => {
          if (searchErr) {
            client.unbind();
            return reject(new Error('Group membership search failed'));
          }

          searchRes.on('searchEntry', (entry) => {
            groups.push({
              dn: entry.objectName,
              name: entry.attributes.find(a => a.type === 'cn')?.values[0]
            });
          });

          searchRes.on('end', () => {
            client.unbind();
            resolve(groups);
          });
        });
      });
    });
  }
}

module.exports = new LdapService();
