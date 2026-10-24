-- Migration 0010: Create cash_drawer_sessions table
CREATE TABLE IF NOT EXISTS cash_drawer_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id),
    opening_float_paisa INTEGER NOT NULL DEFAULT 0,
    cash_sales_paisa INTEGER NOT NULL DEFAULT 0,
    cash_refunds_paisa INTEGER NOT NULL DEFAULT 0,
    expected_cash_paisa INTEGER NOT NULL DEFAULT 0,
    counted_cash_paisa INTEGER,
    variance_paisa INTEGER,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'COUNTED', 'VARIANCE_REVIEW', 'CLOSED')),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    counted_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    reconciled_by UUID REFERENCES staff(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_drawer_one_open_per_staff 
ON cash_drawer_sessions (staff_id) 
WHERE status = 'OPEN';

CREATE INDEX IF NOT EXISTS idx_cash_drawer_staff_id ON cash_drawer_sessions (staff_id);
CREATE INDEX IF NOT EXISTS idx_cash_drawer_status ON cash_drawer_sessions (status);
CREATE INDEX IF NOT EXISTS idx_cash_drawer_opened_at ON cash_drawer_sessions (opened_at);
