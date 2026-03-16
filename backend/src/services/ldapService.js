/**
 * LDAP Service - Handles Active Directory authentication and group membership
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
  }

  /**
   * Create a new LDAP client connection
   */
  createClient() {
    return ldap.createClient({
      url: this.url,
      timeout: 10000,
      connectTimeout: 10000,
      reconnect: true
    });
  }

  /**
   * Authenticate user with LDAP credentials
   */
  async authenticate(username, password) {
    return new Promise((resolve, reject) => {
      const client = this.createClient();
      let userDN = null;
      let userData = null;

      client.on('error', (err) => {
        logger.error('LDAP client error:', err);
        reject(new Error('LDAP connection error'));
      });

      // First, bind with service account to search for user
      client.bind(this.bindDN, this.bindPassword, (bindErr) => {
        if (bindErr) {
          client.unbind();
          logger.error('LDAP service bind failed:', bindErr);
          return reject(new Error('LDAP service authentication failed'));
        }

        // Search for the user
        const searchFilter = `(|(sAMAccountName=${username})(userPrincipalName=${username})(mail=${username}))`;
        const searchOptions = {
          filter: searchFilter,
          scope: 'sub',
          attributes: ['dn', 'sAMAccountName', 'mail', 'displayName', 'memberOf', 'cn', 'givenName', 'sn']
        };

        client.search(this.userSearchBase, searchOptions, (searchErr, searchRes) => {
          if (searchErr) {
            client.unbind();
            logger.error('LDAP search error:', searchErr);
            return reject(new Error('User search failed'));
          }

          searchRes.on('searchEntry', (entry) => {
            userDN = entry.objectName;
            userData = {
              dn: entry.objectName,
              username: entry.attributes.find(a => a.type === 'sAMAccountName')?.values[0] || username,
              email: entry.attributes.find(a => a.type === 'mail')?.values[0],
              displayName: entry.attributes.find(a => a.type === 'displayName')?.values[0] ||
                          entry.attributes.find(a => a.type === 'cn')?.values[0],
              memberOf: entry.attributes.find(a => a.type === 'memberOf')?.values || []
            };
          });

          searchRes.on('error', (err) => {
            client.unbind();
            logger.error('LDAP search result error:', err);
            reject(new Error('User search failed'));
          });

          searchRes.on('end', () => {
            if (!userDN) {
              client.unbind();
              return reject(new Error('User not found'));
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
