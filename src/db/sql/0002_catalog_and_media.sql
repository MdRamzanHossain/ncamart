-- Migration: 0002_catalog_and_media.sql
-- Modules: catalog, media

-- 1. Media Assets Table
CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  bucket TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  width INTEGER,
  height INTEGER,
  duration_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'PENDING_UPLOAD',
  is_public BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  retention_until TIMESTAMPTZ,
  uploaded_by_type TEXT NOT NULL,
  uploaded_by_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_owner ON media_assets(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_kind ON media_assets(kind);
CREATE INDEX IF NOT EXISTS idx_media_assets_status ON media_assets(status);

-- 2. Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
  slug TEXT UNIQUE NOT NULL,
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  level INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  default_fulfillment_type TEXT NOT NULL DEFAULT 'DROP_AND_PACK',
  btrc_clearance_required BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_level ON categories(level);

-- 3. Category Spec Fields Table
CREATE TABLE IF NOT EXISTS category_spec_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  key_name TEXT NOT NULL,
  label_en TEXT NOT NULL,
  label_bn TEXT NOT NULL,
  unit TEXT,
  field_type TEXT NOT NULL,
  enum_options JSONB,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_highlighted_for_comparison BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_category_spec_fields_cat_key UNIQUE (category_id, key_name)
);

CREATE INDEX IF NOT EXISTS idx_category_spec_fields_category_id ON category_spec_fields(category_id);

-- 4. Brands Table
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  is_authorized_distribution BOOLEAN NOT NULL DEFAULT false,
  official_distributor_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brands_slug ON brands(slug);

-- 5. Comparison Groups Table
CREATE TABLE IF NOT EXISTS comparison_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  verdict_en TEXT,
  verdict_bn TEXT,
  badge_authentic_label TEXT NOT NULL DEFAULT 'Full Safety Suite',
  badge_budget_label TEXT NOT NULL DEFAULT 'Best Everyday Value',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comparison_groups_category_id ON comparison_groups(category_id);

-- 6. Products Table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title_en TEXT NOT NULL,
  title_bn TEXT NOT NULL,
  description_en TEXT,
  description_bn TEXT,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  product_tier TEXT NOT NULL,
  fulfillment_type TEXT NOT NULL,
  comparison_group_id UUID REFERENCES comparison_groups(id) ON DELETE SET NULL,
  origin_country TEXT,
  hs_code TEXT,
  btrc_status TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  btrc_clearance_code TEXT,
  vat_rate_bp INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  zero_replica_attested BOOLEAN NOT NULL DEFAULT false,
  zero_replica_attested_by UUID,
  distributor_evidence_media_id UUID,
  comparison_points_en TEXT[],
  comparison_points_bn TEXT[],
  seo_title TEXT,
  seo_description TEXT,
  preorder_eta_days_min INTEGER,
  preorder_eta_days_max INTEGER,
  preorder_batch_threshold INTEGER,
  created_by UUID,
  submitted_by UUID,
  reviewed_by UUID,
  review_notes TEXT,
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_products_budget_smart_replica_attested
    CHECK (status != 'PUBLISHED' OR product_tier != 'BUDGET_SMART' OR zero_replica_attested = true)
);

CREATE INDEX IF NOT EXISTS idx_products_cat_tier_status ON products(category_id, product_tier, status);
CREATE INDEX IF NOT EXISTS idx_products_comparison_group_id ON products(comparison_group_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);

-- 7. SKUs Table
CREATE TABLE IF NOT EXISTS skus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku_code TEXT UNIQUE NOT NULL,
  barcode_ean13 TEXT,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  specs JSONB NOT NULL DEFAULT '{}'::jsonb,
  price_paisa BIGINT NOT NULL,
  compare_at_price_paisa BIGINT,
  base_cost_paisa BIGINT NOT NULL,
  spot_buffer_bp INTEGER NOT NULL DEFAULT 600,
  max_unit_purchase_paisa BIGINT NOT NULL,
  warranty_days INTEGER NOT NULL DEFAULT 0,
  warranty_type TEXT NOT NULL,
  official_distributor_name TEXT,
  weight_grams INTEGER NOT NULL DEFAULT 0,
  daily_order_cap INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skus_product_id ON skus(product_id);
CREATE INDEX IF NOT EXISTS idx_skus_sku_code ON skus(sku_code);
CREATE INDEX IF NOT EXISTS idx_skus_barcode_ean13 ON skus(barcode_ean13);

-- 8. Product Status History Table (Append-only)
CREATE TABLE IF NOT EXISTS product_status_history (
  id BIGSERIAL PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id UUID,
  actor_type TEXT NOT NULL DEFAULT 'STAFF',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_status_history_product_id ON product_status_history(product_id);
CREATE INDEX IF NOT EXISTS idx_product_status_history_created_at ON product_status_history(created_at);

-- Attach forbid_mutation() trigger to product_status_history
DROP TRIGGER IF EXISTS forbid_product_status_history_mutation ON product_status_history;
CREATE TRIGGER forbid_product_status_history_mutation
BEFORE UPDATE OR DELETE ON product_status_history
FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- Role permissions for ncamart_app
GRANT SELECT, INSERT ON product_status_history TO ncamart_app;
REVOKE UPDATE, DELETE, TRUNCATE ON product_status_history FROM ncamart_app;
