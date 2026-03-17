-- =============================================================================
-- HCL DX Composer - Default Role Mappings for Local LDAP
-- =============================================================================
-- Maps local LDAP groups to application roles for full functionality

-- Admin group -> wpsadmin (full access)
INSERT INTO role_mappings (ldap_group_dn, ldap_group_name, app_role) VALUES
('cn=Admins,ou=Groups,dc=hcldx,dc=local', 'Admins', 'wpsadmin')
ON CONFLICT (ldap_group_dn, app_role) DO NOTHING;

-- Authors group -> dxcontentauthors (can create/upload content)
INSERT INTO role_mappings (ldap_group_dn, ldap_group_name, app_role) VALUES
('cn=Authors,ou=Groups,dc=hcldx,dc=local', 'Authors', 'dxcontentauthors')
ON CONFLICT (ldap_group_dn, app_role) DO NOTHING;

-- Reviewers group -> dxcontentapprovers (can approve/reject content)
INSERT INTO role_mappings (ldap_group_dn, ldap_group_name, app_role) VALUES
('cn=Reviewers,ou=Groups,dc=hcldx,dc=local', 'Reviewers', 'dxcontentapprovers')
ON CONFLICT (ldap_group_dn, app_role) DO NOTHING;

-- Publishers group -> dxcontentauthors (can publish approved content)
INSERT INTO role_mappings (ldap_group_dn, ldap_group_name, app_role) VALUES
('cn=Publishers,ou=Groups,dc=hcldx,dc=local', 'Publishers', 'dxcontentauthors')
ON CONFLICT (ldap_group_dn, app_role) DO NOTHING;

-- AllUsers group -> dxcontentauthors (basic content creation)
INSERT INTO role_mappings (ldap_group_dn, ldap_group_name, app_role) VALUES
('cn=AllUsers,ou=Groups,dc=hcldx,dc=local', 'AllUsers', 'dxcontentauthors')
ON CONFLICT (ldap_group_dn, app_role) DO NOTHING;
