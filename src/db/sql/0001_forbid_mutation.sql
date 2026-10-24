-- Migration: forbid_mutation() trigger function & audit_logs protection

-- 1. Generic forbid_mutation function for all append-only tables
CREATE OR REPLACE FUNCTION forbid_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'append-only table: UPDATE or DELETE disallowed on table %', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach trigger to audit_logs
DROP TRIGGER IF EXISTS forbid_audit_logs_mutation ON audit_logs;
CREATE TRIGGER forbid_audit_logs_mutation
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- 3. Idempotent application role setup
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'ncamart_app') THEN
    CREATE ROLE ncamart_app WITH LOGIN PASSWORD 'ncamart_app_dev_pwd';
  END IF;
END
$$;

-- 4. Grants for ncamart_app on append-only audit_logs
GRANT SELECT, INSERT ON audit_logs TO ncamart_app;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM ncamart_app;
