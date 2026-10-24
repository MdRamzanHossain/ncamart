# NCAMart — Database Role Plan & Append-Only Security Model

## Overview
To enforce strict data integrity and tamper-proof operational logs, NCAMart utilizes a multi-role PostgreSQL authorization model combined with database-level triggers.

## Database Roles

### 1. `ncamart_admin` (Migration / Schema Owner Role)
- **Privileges:** Full `ALL PRIVILEGES` on database `ncamart_dev` / `ncamart_prod`.
- **Usage:** Used exclusively during database migrations (`pnpm db:migrate`) and DDL schema alterations.
- **Connection String:** Provided via `DATABASE_MIGRATION_URL` or administrative deployment pipeline.

### 2. `ncamart_app` (Application Runtime Role)
- **Privileges:**
  - **Standard Tables:** `SELECT`, `INSERT`, `UPDATE`, `DELETE` on mutable business entity tables (`customers`, `orders`, `products`, `skus`, `settings`, etc.).
  - **Append-Only Tables:** Strictly restricted to `SELECT` and `INSERT`. `UPDATE`, `DELETE`, and `TRUNCATE` privileges are explicitly `REVOKE`d.
- **Usage:** The Next.js web application and background worker run under `ncamart_app` credentials in production.

## Append-Only Tables

The following tables represent financial, legal, audit, and inventory audit trails where historical record alteration is prohibited:

| Table Name | Description | Enforced By |
| :--- | :--- | :--- |
| `audit_logs` | Cryptographic SHA-256 hash-chained audit trail | Trigger `forbid_mutation()` + Role Revoke |
| `journal_entries` | Financial double-entry ledger headers | Trigger `forbid_mutation()` + Role Revoke |
| `journal_lines` | Balanced debit/credit financial lines | Trigger `forbid_mutation()` + Role Revoke |
| `stock_movements` | Physical inventory in/out audit ledger | Trigger `forbid_mutation()` + Role Revoke |
| `seal_events` | Holographic seal lifecycle state changes | Trigger `forbid_mutation()` + Role Revoke |
| `order_status_history`| Immutable order state machine transitions | Trigger `forbid_mutation()` + Role Revoke |

## Defense-in-Depth Mechanism

1. **Role-Level Grant / Revoke:**
   ```sql
   GRANT SELECT, INSERT ON audit_logs TO ncamart_app;
   REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM ncamart_app;
   ```
2. **Database Trigger Guard (`forbid_mutation`):**
   Even if an application vulnerability or elevated connection attempts `UPDATE` or `DELETE`, the `BEFORE UPDATE OR DELETE` trigger aborts the transaction with:
   `append-only table: UPDATE or DELETE disallowed on table <name>`
