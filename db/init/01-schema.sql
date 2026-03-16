-- =============================================================================
-- HCL DX Composer - PostgreSQL Database Schema
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- Users and Sessions
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ldap_dn VARCHAR(500) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255),
    display_name VARCHAR(255),
    roles TEXT[] DEFAULT '{}',
    ldap_groups TEXT[] DEFAULT '{}',
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_ldap_dn ON users(ldap_dn);

-- -----------------------------------------------------------------------------
-- Role Mappings (LDAP Group to Application Role)
-- -----------------------------------------------------------------------------
CREATE TABLE role_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ldap_group_dn VARCHAR(500) NOT NULL,
    ldap_group_name VARCHAR(255) NOT NULL,
    app_role VARCHAR(50) NOT NULL CHECK (app_role IN ('dxcontentauthors', 'dxcontentapprovers', 'wpsadmin')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(ldap_group_dn, app_role)
);

CREATE INDEX idx_role_mappings_app_role ON role_mappings(app_role);
CREATE INDEX idx_role_mappings_ldap_group ON role_mappings(ldap_group_dn);

-- -----------------------------------------------------------------------------
-- DAM Workflow - Staged Assets
-- -----------------------------------------------------------------------------
CREATE TYPE asset_status AS ENUM ('draft', 'pending_approval', 'approved', 'published', 'rejected');

CREATE TABLE staged_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(500) NOT NULL,
    original_filename VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    thumbnail_path VARCHAR(1000),
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    status asset_status DEFAULT 'draft',
    collection_id UUID,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    dx_asset_id VARCHAR(255),
    dx_collection_id VARCHAR(255),
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_staged_assets_status ON staged_assets(status);
CREATE INDEX idx_staged_assets_uploaded_by ON staged_assets(uploaded_by);
CREATE INDEX idx_staged_assets_collection ON staged_assets(collection_id);

-- -----------------------------------------------------------------------------
-- DAM Collections (for grouping assets)
-- -----------------------------------------------------------------------------
CREATE TYPE collection_status AS ENUM ('draft', 'pending_approval', 'approved', 'published');

CREATE TABLE asset_collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status collection_status DEFAULT 'draft',
    created_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    dx_collection_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_asset_collections_status ON asset_collections(status);
CREATE INDEX idx_asset_collections_created_by ON asset_collections(created_by);

-- Add foreign key for collection
ALTER TABLE staged_assets 
ADD CONSTRAINT fk_staged_assets_collection 
FOREIGN KEY (collection_id) REFERENCES asset_collections(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- WCM Content Items (Staged)
-- -----------------------------------------------------------------------------
CREATE TYPE wcm_status AS ENUM ('draft', 'pending_approval', 'approved', 'published', 'rejected');

CREATE TABLE wcm_staged_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    library_id VARCHAR(255) NOT NULL,
    library_name VARCHAR(255) NOT NULL,
    authoring_template_id VARCHAR(255) NOT NULL,
    authoring_template_name VARCHAR(255) NOT NULL,
    presentation_template_id VARCHAR(255),
    presentation_template_name VARCHAR(255),
    workflow_id VARCHAR(255),
    workflow_name VARCHAR(255),
    current_workflow_stage VARCHAR(255),
    content_elements JSONB NOT NULL DEFAULT '{}',
    status wcm_status DEFAULT 'draft',
    created_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    dx_content_id VARCHAR(255),
    rejection_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_wcm_staged_content_status ON wcm_staged_content(status);
CREATE INDEX idx_wcm_staged_content_library ON wcm_staged_content(library_id);
CREATE INDEX idx_wcm_staged_content_created_by ON wcm_staged_content(created_by);

-- -----------------------------------------------------------------------------
-- Workflow History / Audit Trail
-- -----------------------------------------------------------------------------
CREATE TABLE workflow_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('asset', 'collection', 'wcm_content')),
    entity_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL,
    from_status VARCHAR(50),
    to_status VARCHAR(50),
    performed_by UUID NOT NULL REFERENCES users(id),
    comments TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_workflow_history_entity ON workflow_history(entity_type, entity_id);
CREATE INDEX idx_workflow_history_performed_by ON workflow_history(performed_by);
CREATE INDEX idx_workflow_history_created_at ON workflow_history(created_at);

-- -----------------------------------------------------------------------------
-- System Configuration
-- -----------------------------------------------------------------------------
CREATE TABLE system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO system_config (config_key, config_value, description) VALUES
('dam_default_collection_acl', '{"administrator": "wpsadmin", "user": "Anonymous Portal User"}', 'Default ACL for DAM collections'),
('wcm_default_library', '{"name": "Web Content", "id": ""}', 'Default WCM library'),
('workflow_stages', '["draft", "pending_approval", "approved", "published"]', 'Workflow stages'),
('approval_required_roles', '["dxcontentapprovers", "wpsadmin"]', 'Roles that can approve content'),
('supported_languages', '["en", "hi", "mr"]', 'Supported content languages (English, Hindi, Marathi)'),
('default_language', '"en"', 'Default content language');

-- -----------------------------------------------------------------------------
-- Content Translations (for linking multilingual content)
-- -----------------------------------------------------------------------------
CREATE TABLE content_translations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    translation_group_id UUID NOT NULL,
    content_id UUID NOT NULL REFERENCES wcm_staged_content(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL CHECK (language IN ('en', 'hi', 'mr')),
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(translation_group_id, language)
);

CREATE INDEX idx_content_translations_group ON content_translations(translation_group_id);
CREATE INDEX idx_content_translations_content ON content_translations(content_id);

-- -----------------------------------------------------------------------------
-- AI Generation History (for tracking AI-generated images/creatives)
-- -----------------------------------------------------------------------------
CREATE TABLE ai_generation_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt TEXT NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'openai',
    options JSONB DEFAULT '{}',
    result_count INTEGER DEFAULT 1,
    staged_asset_ids JSONB DEFAULT '[]',
    generated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_history_user ON ai_generation_history(generated_by);
CREATE INDEX idx_ai_history_created ON ai_generation_history(created_at DESC);

-- -----------------------------------------------------------------------------
-- Function to update updated_at timestamp
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_role_mappings_updated_at BEFORE UPDATE ON role_mappings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staged_assets_updated_at BEFORE UPDATE ON staged_assets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_asset_collections_updated_at BEFORE UPDATE ON asset_collections 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wcm_staged_content_updated_at BEFORE UPDATE ON wcm_staged_content 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
