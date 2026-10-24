-- Migration: 0007_cart_holds.sql
-- Module: orders / inventory (P19 - Cart Validation & Stock Reservation Endpoints)
-- Tables: cart_holds, and stock_reservations alteration

-- 1. Create cart_holds table
CREATE TABLE IF NOT EXISTS cart_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'CONVERTED' | 'RELEASED' | 'EXPIRED'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cart_holds_device_id ON cart_holds(device_id);
CREATE INDEX IF NOT EXISTS idx_cart_holds_status_expires ON cart_holds(status, expires_at);

-- 2. Alter stock_reservations to support cart_hold_id and nullable order_id
ALTER TABLE stock_reservations ALTER COLUMN order_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_reservations' AND column_name = 'cart_hold_id'
  ) THEN
    ALTER TABLE stock_reservations ADD COLUMN cart_hold_id UUID REFERENCES cart_holds(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stock_reservations_cart_hold_id ON stock_reservations(cart_hold_id);

-- Constraint: exactly one of order_id or cart_hold_id must be populated
ALTER TABLE stock_reservations DROP CONSTRAINT IF EXISTS stock_reservations_owner_check;
ALTER TABLE stock_reservations ADD CONSTRAINT stock_reservations_owner_check
  CHECK ((order_id IS NOT NULL AND cart_hold_id IS NULL) OR (order_id IS NULL AND cart_hold_id IS NOT NULL));
