-- Migration: 0006_orders.sql
-- Module: orders (P18 - Order Schema & State Machines)
-- Tables: orders, order_items, order_item_units, order_status_history, pre_orders, payment_transactions

-- 1. Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  channel TEXT NOT NULL, -- 'STOREFRONT_WEB' | 'SHOWROOM_POS' | 'PHONE_ORDER'
  order_type TEXT NOT NULL, -- 'REGULAR_DROP_PACK' | 'PRE_ORDER'
  fulfillment_channel TEXT NOT NULL, -- 'COURIER' | 'PICKUP' | 'WALK_IN'
  delivery_zone TEXT, -- 'INSIDE_DHAKA' | 'OUTSIDE_DHAKA'
  status TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'UNPAID', -- 'UNPAID' | 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'REFUND_PENDING' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'FAILED'
  payment_mode TEXT NOT NULL, -- 'ONLINE_FULL' | 'COD' | 'PAY_AT_COUNTER' | 'PREORDER_DEPOSIT'
  address_snapshot JSONB,
  subtotal_paisa BIGINT NOT NULL,
  discount_paisa BIGINT NOT NULL DEFAULT 0,
  delivery_fee_paisa BIGINT NOT NULL DEFAULT 0,
  vat_total_paisa BIGINT NOT NULL DEFAULT 0,
  total_payable_paisa BIGINT NOT NULL,
  store_credit_applied_paisa BIGINT NOT NULL DEFAULT 0,
  advance_required_paisa BIGINT NOT NULL DEFAULT 0,
  advance_paid_paisa BIGINT NOT NULL DEFAULT 0,
  advance_purpose TEXT, -- 'DELIVERY_FEE' | 'DEPOSIT' | 'FULL'
  cod_amount_paisa BIGINT NOT NULL DEFAULT 0,
  paid_total_paisa BIGINT NOT NULL DEFAULT 0,
  refunded_total_paisa BIGINT NOT NULL DEFAULT 0,
  coupon_id UUID REFERENCES coupons(id),
  mushak_requested BOOLEAN NOT NULL DEFAULT FALSE,
  buyer_company_name TEXT,
  buyer_bin TEXT,
  pickup_pin_hash TEXT,
  pickup_pin_expires_at TIMESTAMPTZ,
  pickup_pin_attempts INTEGER NOT NULL DEFAULT 0,
  pickup_pin_locked BOOLEAN NOT NULL DEFAULT FALSE,
  placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_created ON orders (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_type ON orders (status, order_type);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders (payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders (order_number);

-- 2. Order Items table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES skus(id),
  product_id UUID NOT NULL REFERENCES products(id),
  title_en TEXT NOT NULL,
  title_bn TEXT NOT NULL,
  tier TEXT NOT NULL,
  sku_code TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_price_paisa BIGINT NOT NULL,
  allocated_discount_paisa BIGINT NOT NULL DEFAULT 0,
  line_total_paisa BIGINT NOT NULL,
  vat_rate_bp INTEGER NOT NULL,
  vat_paisa BIGINT NOT NULL,
  unit_cost_paisa BIGINT,
  source TEXT NOT NULL, -- 'PHYSICAL' | 'VIRTUAL'
  source_location_id UUID REFERENCES locations(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'CANCELLED' | 'DELIVERED' | 'RETURNED' | 'RTO'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_sku_id ON order_items (sku_id);

-- 3. Order Item Units table (1 row per physical unit: qty 3 -> 3 rows for holographic seal P26)
CREATE TABLE IF NOT EXISTS order_item_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  unit_index INTEGER NOT NULL,
  seal_id UUID,
  manufacturer_serial TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'ALLOCATED' | 'SEALED' | 'DELIVERED' | 'RETURNED' | 'RTO'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_item_units_item_id ON order_item_units (order_item_id);

-- 4. Order Status History table (append-only)
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_type TEXT NOT NULL, -- 'CUSTOMER' | 'STAFF' | 'SYSTEM'
  actor_id UUID,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history (order_id, created_at ASC);

DROP TRIGGER IF EXISTS trg_forbid_mutation_order_status_history ON order_status_history;
CREATE TRIGGER trg_forbid_mutation_order_status_history
  BEFORE UPDATE OR DELETE ON order_status_history
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- 5. Pre-Orders table
CREATE TABLE IF NOT EXISTS pre_orders (
  order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  deposit_paisa BIGINT NOT NULL,
  balance_paisa BIGINT NOT NULL,
  eta_date TIMESTAMPTZ NOT NULL,
  eta_min_days INTEGER NOT NULL,
  eta_max_days INTEGER NOT NULL,
  price_locked_paisa BIGINT NOT NULL,
  milestone TEXT NOT NULL, -- 'DEPOSIT_PENDING' | 'DEPOSIT_PAID' | 'SOURCED_IN_TRANSIT' | 'ARRIVED_GODOWN' | 'QC_VERIFIED' | 'BALANCE_PAID' | 'DISPATCHED' | 'DELIVERED'
  arrived_at TIMESTAMPTZ,
  qc_verified_at TIMESTAMPTZ,
  balance_due_date TIMESTAMPTZ,
  forfeiture_date TIMESTAMPTZ,
  repricing_status TEXT NOT NULL DEFAULT 'NONE', -- 'NONE' | 'PENDING' | 'ACCEPTED' | 'REJECTED'
  repricing_new_total_paisa BIGINT,
  repricing_deadline TIMESTAMPTZ,
  delay_option TEXT NOT NULL DEFAULT 'NONE', -- 'NONE' | 'OFFERED' | 'CANCELLED' | 'KEPT_WITH_CREDIT'
  delay_offered_at TIMESTAMPTZ,
  batch_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Payment Transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tran_id TEXT NOT NULL UNIQUE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  purpose TEXT NOT NULL, -- 'FULL' | 'ADVANCE_FEE' | 'DEPOSIT' | 'BALANCE'
  method TEXT NOT NULL, -- 'SSLCOMMERZ' | 'CASH_COUNTER' | 'BKASH_QR' | 'NAGAD_QR' | 'CARD_TERMINAL' | 'COURIER_COD' | 'STORE_CREDIT'
  amount_paisa BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BDT',
  status TEXT NOT NULL DEFAULT 'INITIATED', -- 'INITIATED' | 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'HOLD_REVIEW' | 'EXPIRED'
  gateway_session_key TEXT,
  val_id TEXT,
  bank_tran_id TEXT,
  card_type TEXT,
  risk_level TEXT,
  risk_title TEXT,
  validated_at TIMESTAMPTZ,
  raw_ipn JSONB,
  raw_validation JSONB,
  external_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON payment_transactions (order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions (status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_customer ON payment_transactions (customer_id);
