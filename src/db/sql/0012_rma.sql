-- 0012_rma.sql
-- Module: rma (Warranty Claims & Reverse Logistics)

CREATE TABLE IF NOT EXISTS warranty_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number VARCHAR(32) NOT NULL UNIQUE,
  seal_id VARCHAR(32) NOT NULL,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_unit_id UUID REFERENCES order_item_units(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  claim_type VARCHAR(32) NOT NULL,
  issue_description TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED',
  priority VARCHAR(32) NOT NULL DEFAULT 'NORMAL',
  decision TEXT,
  rejection_reason VARCHAR(32),
  resolution VARCHAR(32),
  reverse_shipment_id UUID REFERENCES courier_shipments(id) ON DELETE SET NULL,
  replacement_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  sla_due_at TIMESTAMPTZ,
  adjudicated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  adjudicated_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  is_non_original_owner BOOLEAN NOT NULL DEFAULT FALSE,
  wants_assisted_transit BOOLEAN NOT NULL DEFAULT FALSE,
  distributor_name TEXT,
  distributor_sent_at TIMESTAMPTZ,
  distributor_returned_at TIMESTAMPTZ,
  distributor_outcome VARCHAR(32),
  liaison_task_id UUID REFERENCES runner_tasks(id) ON DELETE SET NULL,
  inspection_notes TEXT,
  verified_defect BOOLEAN,
  seal_intact BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warranty_claims_seal_id ON warranty_claims(seal_id);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_order_id ON warranty_claims(order_id);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_customer_id ON warranty_claims(customer_id);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_status ON warranty_claims(status);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_priority ON warranty_claims(priority);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_created_at ON warranty_claims(created_at);

-- Claim events (append-only timeline)
CREATE TABLE IF NOT EXISTS claim_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES warranty_claims(id) ON DELETE CASCADE,
  from_status VARCHAR(32),
  to_status VARCHAR(32) NOT NULL,
  actor_type VARCHAR(32) NOT NULL,
  actor_id UUID,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claim_events_claim_id ON claim_events(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_events_created_at ON claim_events(created_at);

-- Enforce append-only on claim_events
DROP TRIGGER IF EXISTS trg_claim_events_forbid_mutation ON claim_events;
CREATE TRIGGER trg_claim_events_forbid_mutation
  BEFORE UPDATE OR DELETE ON claim_events
  FOR EACH ROW
  EXECUTE FUNCTION forbid_mutation();
