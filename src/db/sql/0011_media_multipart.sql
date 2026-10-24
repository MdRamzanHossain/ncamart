-- Migration: 0011_media_multipart.sql
-- Modules: media

ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS upload_id TEXT;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS flagged BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS flag_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_media_assets_retention_until ON media_assets(retention_until);
CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON media_assets(created_at);
