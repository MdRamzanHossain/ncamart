-- Migration: 0004_promotions.sql
-- Module: promotions (Coupons, redemptions, store credit entries)

-- 1. Coupons Table
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('FIXED', 'PERCENT')),
  value BIGINT NOT NULL CHECK (value > 0),
  min_order_paisa BIGINT NOT NULL DEFAULT 0,
  max_discount_paisa BIGINT,
  scope_type TEXT NOT NULL DEFAULT 'ALL' CHECK (scope_type IN ('ALL', 'TIER', 'CATEGORY', 'SKU')),
  scope_values TEXT[],
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  usage_limit INTEGER CHECK (usage_limit IS NULL OR usage_limit > 0),
  per_phone_limit INTEGER NOT NULL DEFAULT 1 CHECK (per_phone_limit > 0),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED')),
  created_by UUID NOT NULL,
  activated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_coupons_dates CHECK (ends_at > starts_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_status ON coupons(status);
CREATE INDEX IF NOT EXISTS idx_coupons_dates ON coupons(starts_at, ends_at);

-- 2. Coupon Redemptions Table
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL UNIQUE,
  customer_id UUID,
  phone TEXT NOT NULL,
  discount_paisa BIGINT NOT NULL CHECK (discount_paisa >= 0),
  status TEXT NOT NULL CHECK (status IN ('RESERVED', 'CONFIRMED', 'RELEASED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_coupon_redemptions_order ON coupon_redemptions(order_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon_status ON coupon_redemptions(coupon_id, status);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_phone ON coupon_redemptions(coupon_id, phone, status);

-- 3. Store Credit Entries Table (Append-Only)
CREATE TABLE IF NOT EXISTS store_credit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  delta_paisa BIGINT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'GOODWILL', 'PREORDER_DELAY', 'RMA_RESOLUTION', 'REFUND_AS_CREDIT',
    'APPLIED_TO_ORDER', 'REVERSAL', 'EXPIRY', 'WITHDRAWAL'
  )),
  withdrawable BOOLEAN NOT NULL,
  expires_at TIMESTAMPTZ,
  source_entry_id UUID REFERENCES store_credit_entries(id),
  ref_type TEXT,
  ref_id TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_credit_customer ON store_credit_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_store_credit_source ON store_credit_entries(source_entry_id);
CREATE INDEX IF NOT EXISTS idx_store_credit_expires ON store_credit_entries(expires_at);
CREATE INDEX IF NOT EXISTS idx_store_credit_created_at ON store_credit_entries(created_at);

-- Attach forbid_mutation() trigger to store_credit_entries (Append-Only)
DROP TRIGGER IF EXISTS trg_store_credit_forbid_mutation ON store_credit_entries;
CREATE TRIGGER trg_store_credit_forbid_mutation
  BEFORE UPDATE OR DELETE ON store_credit_entries
  FOR EACH ROW
  EXECUTE FUNCTION forbid_mutation();
