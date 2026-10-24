-- Migration: 0005_ledger.sql
-- Module: ledger (In-House Double-Entry Accounting Ledger Engine)

-- 1. Ledger Accounts (Chart of Accounts)
CREATE TABLE IF NOT EXISTS ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE')),
  normal_side TEXT NOT NULL CHECK (normal_side IN ('DEBIT', 'CREDIT')),
  is_contra BOOLEAN NOT NULL DEFAULT FALSE,
  requires_sub_ledger BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_accounts_code ON ledger_accounts(code);
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_type ON ledger_accounts(type);

-- 2. Journal Entries (Header)
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number VARCHAR(30) UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  description TEXT NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_by_type TEXT NOT NULL CHECK (posted_by_type IN ('STAFF', 'SYSTEM')),
  posted_by_id UUID,
  reversal_of UUID REFERENCES journal_entries(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_journal_entries_idempotency UNIQUE(event_type, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_posted_at ON journal_entries(posted_at);
CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON journal_entries(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_event ON journal_entries(event_type);

-- 3. Journal Lines (Debits and Credits)
CREATE TABLE IF NOT EXISTS journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES ledger_accounts(id) ON DELETE RESTRICT,
  sub_ledger_type TEXT CHECK (sub_ledger_type IS NULL OR sub_ledger_type IN ('ORDER', 'CUSTOMER', 'COURIER', 'SUPPLIER', 'RUNNER', 'DRAWER')),
  sub_ledger_ref TEXT,
  debit_paisa BIGINT NOT NULL DEFAULT 0,
  credit_paisa BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_journal_lines_one_side CHECK (
    debit_paisa >= 0 AND credit_paisa >= 0 AND (debit_paisa = 0) <> (credit_paisa = 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_subledger ON journal_lines(account_id, sub_ledger_type, sub_ledger_ref);

-- 4. Balanced Entry Deferrable Constraint Trigger (architechture.md §10.1)
CREATE OR REPLACE FUNCTION assert_entry_balanced() RETURNS trigger AS $$
BEGIN
  IF (SELECT COALESCE(SUM(debit_paisa), 0) - COALESCE(SUM(credit_paisa), 0)
      FROM journal_lines WHERE entry_id = NEW.entry_id) <> 0 THEN
    RAISE EXCEPTION 'Unbalanced journal entry %', NEW.entry_id;
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS journal_balanced ON journal_lines;
CREATE CONSTRAINT TRIGGER journal_balanced
AFTER INSERT ON journal_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION assert_entry_balanced();

-- 5. Append-Only Triggers for Journal Entries & Lines
DROP TRIGGER IF EXISTS forbid_journal_entries_mutation ON journal_entries;
CREATE TRIGGER forbid_journal_entries_mutation
BEFORE UPDATE OR DELETE ON journal_entries
FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

DROP TRIGGER IF EXISTS forbid_journal_lines_mutation ON journal_lines;
CREATE TRIGGER forbid_journal_lines_mutation
BEFORE UPDATE OR DELETE ON journal_lines
FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
