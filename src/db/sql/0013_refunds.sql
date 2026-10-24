-- Migration 0013: Refunds and Refund Events (P33)

CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_number TEXT NOT NULL UNIQUE,
  order_id UUID NOT NULL REFERENCES orders(id),
  order_item_ids TEXT[] NOT NULL DEFAULT '{}',
  payment_tran_id TEXT,
  amount_paisa BIGINT NOT NULL,
  reason TEXT NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'REQUESTED',
  is_before_delivery BOOLEAN NOT NULL DEFAULT true,
  requested_by_type TEXT NOT NULL DEFAULT 'SYSTEM',
  requested_by_id TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  executed_by TEXT,
  executed_at TIMESTAMPTZ,
  external_ref TEXT,
  proof_media_id TEXT,
  gateway_refund_ref TEXT,
  payout_account TEXT,
  due_by TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_due_by ON refunds(due_by);

CREATE TABLE IF NOT EXISTS refund_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id UUID NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refund_events_refund_id ON refund_events(refund_id);
CREATE INDEX IF NOT EXISTS idx_refund_events_created_at ON refund_events(created_at);

-- Append-only trigger for refund_events
DROP TRIGGER IF EXISTS trg_refund_events_forbid_mutation ON refund_events;
CREATE TRIGGER trg_refund_events_forbid_mutation
  BEFORE UPDATE OR DELETE ON refund_events
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
