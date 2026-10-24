-- Migration: 0003_inventory.sql
-- Module: inventory (Physical inventory, locations, movements, reservations)

-- 1. Locations Table
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  is_sellable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locations_code ON locations(code);
CREATE INDEX IF NOT EXISTS idx_locations_is_sellable ON locations(is_sellable);

-- Seed canonical locations from P00
INSERT INTO locations (id, code, name, is_sellable)
VALUES
  ('01920000-0001-7000-8000-000000000001', 'GODOWN_NAWABPUR', 'Nawabpur Main Godown', true),
  ('01920000-0001-7000-8000-000000000002', 'SHOWROOM_COUNTER', 'Showroom POS Counter', true),
  ('01920000-0001-7000-8000-000000000003', 'QC_HOLD', 'QC Hold Bay', false),
  ('01920000-0001-7000-8000-000000000004', 'RMA_HOLD', 'RMA Inspection Hold', false),
  ('01920000-0001-7000-8000-000000000005', 'DAMAGED', 'Damaged / Quarantine Area', false),
  ('01920000-0001-7000-8000-000000000006', 'IN_TRANSIT', 'In Transit / Pre-Order', false)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, is_sellable = EXCLUDED.is_sellable;

-- 2. Inventory Balances Table
CREATE TABLE IF NOT EXISTS inventory_balances (
  sku_id UUID NOT NULL,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  on_hand INTEGER NOT NULL DEFAULT 0,
  reserved INTEGER NOT NULL DEFAULT 0,
  safety_stock INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sku_id, location_id),
  CONSTRAINT inventory_balances_check CHECK (reserved >= 0 AND on_hand >= reserved)
);

CREATE INDEX IF NOT EXISTS idx_inventory_balances_location ON inventory_balances(location_id);

-- 3. Stock Movements Table (Append-Only)
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id UUID NOT NULL,
  from_location_id UUID REFERENCES locations(id),
  to_location_id UUID REFERENCES locations(id),
  qty INTEGER NOT NULL CHECK (qty > 0),
  reason TEXT NOT NULL,
  ref_type TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  unit_cost_paisa BIGINT NOT NULL,
  staff_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_sku_id ON stock_movements(sku_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_from_loc ON stock_movements(from_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_to_loc ON stock_movements(to_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ref ON stock_movements(ref_type, ref_id);

-- Attach forbid_mutation() trigger to stock_movements
DROP TRIGGER IF EXISTS forbid_stock_movements_mutation ON stock_movements;
CREATE TRIGGER forbid_stock_movements_mutation
BEFORE UPDATE OR DELETE ON stock_movements
FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- 4. Stock Reservations Table
CREATE TABLE IF NOT EXISTS stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  order_item_id UUID,
  sku_id UUID NOT NULL,
  location_id UUID NOT NULL REFERENCES locations(id),
  qty INTEGER NOT NULL CHECK (qty > 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  committed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_status_expires ON stock_reservations(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_order_id ON stock_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_sku_location ON stock_reservations(sku_id, location_id);

-- 5. Stock Adjustment Requests Table
CREATE TABLE IF NOT EXISTS stock_adjustment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id UUID NOT NULL,
  location_id UUID NOT NULL REFERENCES locations(id),
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  requested_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_adj_sku_loc ON stock_adjustment_requests(sku_id, location_id);
CREATE INDEX IF NOT EXISTS idx_stock_adj_status ON stock_adjustment_requests(status);

-- 6. Cycle Counts Table
CREATE TABLE IF NOT EXISTS cycle_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  started_by UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cycle_counts_location ON cycle_counts(location_id);
CREATE INDEX IF NOT EXISTS idx_cycle_counts_status ON cycle_counts(status);

-- 7. Cycle Count Lines Table
CREATE TABLE IF NOT EXISTS cycle_count_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id UUID NOT NULL REFERENCES cycle_counts(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL,
  system_qty INTEGER NOT NULL,
  counted_qty INTEGER NOT NULL,
  variance INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cycle_count_lines_count_id ON cycle_count_lines(count_id);
CREATE INDEX IF NOT EXISTS idx_cycle_count_lines_sku_id ON cycle_count_lines(sku_id);
