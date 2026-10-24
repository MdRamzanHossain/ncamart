-- Migration: 0009_courier_claims.sql
-- Module: logistics (P29 - Courier Webhooks, Delivery, RTO & Warranty Start)
-- Table: courier_claims

CREATE TABLE IF NOT EXISTS courier_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES courier_shipments(id) ON DELETE CASCADE,
  amount_paisa BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'APPROVED' | 'REJECTED' | 'SETTLED'
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courier_claims_shipment_id ON courier_claims(shipment_id);
CREATE INDEX IF NOT EXISTS idx_courier_claims_status ON courier_claims(status);
