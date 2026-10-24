-- Migration: 0008_logistics.sql
-- Module: logistics (P28 - Packing, Dispatch Queue & Courier Booking)
-- Tables: courier_shipments, courier_events, courier_location_map

-- 1. Create courier_shipments table
CREATE TABLE IF NOT EXISTS courier_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  courier TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'FORWARD', -- 'FORWARD' | 'REVERSE'
  consignment_no TEXT UNIQUE,
  tracking_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING_BOOKING',
  weight_grams INTEGER NOT NULL,
  expected_cod_paisa BIGINT NOT NULL,
  collected_cod_paisa BIGINT,
  delivery_charge_paisa BIGINT,
  cod_charge_paisa BIGINT,
  return_charge_paisa BIGINT,
  booking_attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  booked_at TIMESTAMPTZ,
  handed_over_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  last_event_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courier_shipments_order_id ON courier_shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_courier_shipments_status ON courier_shipments(status);
CREATE INDEX IF NOT EXISTS idx_courier_shipments_courier ON courier_shipments(courier);
CREATE UNIQUE INDEX IF NOT EXISTS uq_courier_shipments_consignment_no ON courier_shipments(consignment_no);

-- 2. Create courier_events table
CREATE TABLE IF NOT EXISTS courier_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES courier_shipments(id) ON DELETE CASCADE,
  raw_status TEXT NOT NULL,
  normalized_status TEXT NOT NULL,
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dedupe_key TEXT UNIQUE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_courier_events_shipment_id ON courier_events(shipment_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_courier_events_dedupe_key ON courier_events(dedupe_key);

-- 3. Create courier_location_map table
CREATE TABLE IF NOT EXISTS courier_location_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier TEXT NOT NULL,
  district TEXT NOT NULL,
  thana TEXT NOT NULL,
  hub_id TEXT,
  city_id TEXT,
  zone_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courier_location_map_lookup ON courier_location_map(courier, district, thana);
