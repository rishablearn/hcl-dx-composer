-- Migration: Track HCL DX Collections
-- Reference: https://opensource.hcltechsw.com/experience-api-documentation/dam-api/

CREATE TABLE IF NOT EXISTS dx_collections (
  id SERIAL PRIMARY KEY,
  dx_collection_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  collection_type VARCHAR(50) DEFAULT 'general',
  keywords TEXT[],
  created_by VARCHAR(255),
  dx_created_at TIMESTAMP,
  dx_updated_at TIMESTAMP,
  local_created_at TIMESTAMP DEFAULT NOW(),
  local_updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_dx_collections_name ON dx_collections(name);
CREATE INDEX IF NOT EXISTS idx_dx_collections_type ON dx_collections(collection_type);

-- Track which assets are in which DX collections
CREATE TABLE IF NOT EXISTS dx_collection_assets (
  id SERIAL PRIMARY KEY,
  dx_collection_id VARCHAR(255) NOT NULL,
  dx_asset_id VARCHAR(255) NOT NULL,
  staged_asset_id INTEGER REFERENCES staged_assets(id),
  uploaded_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(dx_collection_id, dx_asset_id)
);

CREATE INDEX IF NOT EXISTS idx_dx_collection_assets_collection ON dx_collection_assets(dx_collection_id);
CREATE INDEX IF NOT EXISTS idx_dx_collection_assets_asset ON dx_collection_assets(dx_asset_id);
