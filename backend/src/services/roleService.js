/**
 * Role Service - Handles LDAP group to application role mapping
 */

const db = require('../config/database');
const logger = require('../config/logger');

class RoleService {
  /**
   * Get all role mappings
   */
  async getAllMappings() {
    const result = await db.query(`
      SELECT rm.*, u.username as created_by_username
      FROM role_mappings rm
      LEFT JOIN users u ON rm.created_by = u.id
      ORDER BY rm.app_role, rm.ldap_group_name
    `);
    return result.rows;
  }

  /**
   * Get mappings for a specific application role
   */
  async getMappingsForRole(appRole) {
    const result = await db.query(
      'SELECT * FROM role_mappings WHERE app_role = $1',
      [appRole]
    );
    return result.rows;
  }

  /**
   * Create a new role mapping
   */
  async createMapping(ldapGroupDn, ldapGroupName, appRole, createdBy) {
    const result = await db.query(`
      INSERT INTO role_mappings (ldap_group_dn, ldap_group_name, app_role, created_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (ldap_group_dn, app_role) DO UPDATE SET
        ldap_group_name = EXCLUDED.ldap_group_name,
        updated_at = NOW()
      RETURNING *
    `, [ldapGroupDn, ldapGroupName, appRole, createdBy]);
    
    logger.info(`Role mapping created/updated: ${ldapGroupName} -> ${appRole}`);
    return result.rows[0];
  }

  /**
   * Delete a role mapping
   */
  async deleteMapping(id) {
    const result = await db.query(
      'DELETE FROM role_mappings WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows[0]) {
      logger.info(`Role mapping deleted: ${result.rows[0].ldap_group_name}`);
    }
    return result.rows[0];
  }

  /**
   * Get application roles for a user based on their LDAP groups
   */
  async getUserRoles(ldapGroups) {
    if (!ldapGroups || ldapGroups.length === 0) {
      return [];
    }

    // Normalize LDAP group DNs for comparison
    const normalizedGroups = ldapGroups.map(g => g.toLowerCase());
    
    const result = await db.query(`
      SELECT DISTINCT app_role 
      FROM role_mappings 
      WHERE LOWER(ldap_group_dn) = ANY($1)
    `, [normalizedGroups]);

    return result.rows.map(r => r.app_role);
  }

  /**
   * Check if user has a specific role
   */
  async userHasRole(ldapGroups, requiredRole) {
    const roles = await this.getUserRoles(ldapGroups);
    return roles.includes(requiredRole);
  }

  /**
   * Check if user has any of the specified roles
   */
  async userHasAnyRole(ldapGroups, requiredRoles) {
    const roles = await this.getUserRoles(ldapGroups);
    return requiredRoles.some(r => roles.includes(r));
  }

  /**
   * Get valid application roles
   */
  getValidRoles() {
    return ['dxcontentauthors', 'dxcontentapprovers', 'wpsadmin'];
  }
}

module.exports = new RoleService();
