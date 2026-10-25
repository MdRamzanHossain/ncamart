# NCAMart Production Operations Runbook

**Version:** 1.0  
**Target Environments:** Staging (`staging.ncamart.com`) · Production (`ncamart.com`)  
**Architecture Reference:** [architechture.md §17](./architechture.md)  
**Classification:** Internal Confidential / Ops & SRE Manual  

---

## 1. System Topology Overview

```
                      ┌────────────────────────────────────────┐
                      │            Cloudflare (Pro)            │
                      │  DNS · WAF · DDoS · SSL · Turnstile    │
                      └───────────────────┬────────────────────┘
                                          │
                      ┌───────────────────▼────────────────────┐
                      │  App VPS (Singapore — 4 vCPU, 8 GB RAM)│
                      │  Docker Compose Topology               │
                      │                                        │
                      │  ┌──────────┐                          │
                      │  │  Caddy   │ TLS Reverse Proxy & LB   │
                      │  └─────┬────┘                          │
                      │        ├────────────────┐              │
                      │  ┌─────▼────┐    ┌──────▼────┐         │
                      │  │  web_1   │    │  web_2    │         │
                      │  │ (Next.js)│    │ (Next.js) │         │
                      │  └─────┬────┘    └──────┬────┘         │
                      │        └───────┬────────┘              │
                      │          ┌─────▼──────┐                │
                      │          │   worker   │                │
                      │          │  (Node.js) │                │
                      │          └─────┬──────┘                │
                      │                │                       │
                      │  ┌─────────────┴────────────┐          │
                      │  │ Redis 7 (AOF) · Meilisearch│        │
                      │  └──────────────────────────┘          │
                      └──────────────┬─────────────────────────┘
                                     │
           ┌─────────────────────────┴────────────────────────┐
           │                                                  │
┌──────────▼──────────────────────┐        ┌──────────────────▼─────────────────┐
│ Managed PostgreSQL 16 (Primary) │        │     Cloudflare R2 Object Storage   │
│ Standby Replica · 7-day PITR    │        │ Media · Invoices · Feeds · Backups │
│ Daily Snapshots (30-day Ret.)   │        │ Audit Log Exports (Object Lock)    │
└─────────────────────────────────┘        └────────────────────────────────────┘
```

---

## 2. Multi-Replica Operational Requirements

NCAMart runs Next.js in a multi-replica configuration (`web_1` and `web_2`) behind Caddy load-balancing. To prevent state divergence, session drops, and hydration failures across replicas, the following configuration must be maintained:

### 2.1 Shared Redis-Backed Cache Handler
- **Implementation:** `src/lib/cache/redisCacheHandler.cjs`
- **Purpose:** Synchronizes Next.js Data Cache and Incremental Static Regeneration (ISR) across all web nodes. Tag invalidation (`revalidateTag`) updates Redis Sets so that both `web_1` and `web_2` invalidate pages simultaneously.
- **Verification:**
  ```bash
  docker compose -f docker/compose.prod.yml exec redis redis-cli -a "$REDIS_PASSWORD" keys "next:cache:*"
  ```

### 2.2 Server Actions Encryption Key
- **Environment Variable:** `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
- **Constraint:** Must be identical across all web replicas. Next.js encrypts Server Action IDs and closure arguments using this key. If replicas have mismatched keys, an action submitted from a client load-balanced to `web_2` that was rendered by `web_1` will throw a decryption error: `Failed to decrypt server action argument`.
- **Generation:**
  ```bash
  openssl rand -hex 32
  ```

### 2.3 Synchronized Deployment ID
- **Environment Variable:** `NEXT_DEPLOYMENT_ID` (set to git commit short SHA).
- **Purpose:** Next.js uses `deploymentId` to guarantee that client bundles requesting static chunks from CDN or alternate replicas match the server runtime code during rolling updates.

---

## 3. Reliability Targets, RPO & RTO

| Metric | Target | Realization Strategy |
| :--- | :--- | :--- |
| **Availability (SLA)** | **99.5%** | Multi-replica web tier, automated container healthchecks, Caddy failover, managed database standby. |
| **Recovery Point Objective (RPO)** | **≤ 5 minutes** | PostgreSQL continuous WAL archiving (pushed every 5 min) + Point-in-Time Recovery (PITR). |
| **Recovery Time Objective (RTO)** | **≤ 2 hours** | App VPS is stateless. Rebuildable from GHCR images + `compose.prod.yml` in < 20 min. Redis and Meilisearch are rebuildable from PostgreSQL. |

---

## 4. Backup Architecture & Disaster Recovery

### 4.1 Backup Strategy (3-Tier)
1. **Tier 1 — Managed Continuous WAL & PITR:**
   - Provider: Managed Cloud PostgreSQL (DigitalOcean / AWS RDS / Supabase).
   - Frequency: Continuous streaming WAL archiving.
   - Retention: 7 days.
   - Point-in-time granularity: Can restore to any second within the retention window.
2. **Tier 2 — Daily Automated Snapshots:**
   - Full storage volume snapshot automated at 02:00 Asia/Dhaka.
   - Retention: 30 days rolling.
3. **Tier 3 — Weekly Logical Dump (Off-Site):**
   - Job: `weekly-database-backup` runs every Sunday at 03:00 Asia/Dhaka.
   - Engine: `pg_dump -Fc` (compressed custom format).
   - Destination: Cloudflare R2 bucket `env.S3_BUCKET_PRIVATE` under `backups/db_logical_YYYY-MM-DD_*.dump`.
   - Retention: 90 days lifecycle rule.

### 4.2 Monthly Disaster Recovery Restore Drill Procedure
Drills are executed on the **first Sunday of every month** into the staging environment:

1. **Notify Team:** Send maintenance notice in `#ops-alerts` Slack/Discord.
2. **Retrieve Latest Logical Dump from R2:**
   ```bash
   # List available backups in Cloudflare R2
   aws s3 ls s3://ncamart-private/backups/ --endpoint-url "$S3_ENDPOINT"

   # Download the latest backup archive
   aws s3 cp s3://ncamart-private/backups/<LATEST_DUMP_NAME> /tmp/ncamart_restore.dump --endpoint-url "$S3_ENDPOINT"
   ```
3. **Prepare Clean Staging Database:**
   ```bash
   # Terminate existing connections and drop staging database
   psql "$STAGING_DATABASE_ADMIN_URL" -c "DROP DATABASE IF EXISTS ncamart_drill;"
   psql "$STAGING_DATABASE_ADMIN_URL" -c "CREATE DATABASE ncamart_drill;"
   ```
4. **Restore Database from Dump:**
   ```bash
   pg_restore -v --no-owner --clean --if-exists -d "$STAGING_DRILL_DATABASE_URL" /tmp/ncamart_restore.dump
   ```
5. **Verify Data Integrity:**
   - Check journal entries and append-only constraints:
     ```sql
     SELECT count(*) as total_journals FROM journal_entries;
     SELECT count(*) as total_orders FROM orders;
     SELECT count(*) as total_seals FROM seal_records;
     ```
   - Verify audit log hash chain continuity:
     ```bash
     pnpm tsx -e "
       import { auditService } from './src/modules/audit';
       const res = await auditService.verifyChainIntegrity();
       console.log('Audit chain valid:', res.valid);
       if (!res.valid) process.exit(1);
     "
     ```
6. **Rebuild Search Indexes:**
   ```bash
   pnpm search:reindex
   ```
7. **Document Drill Results:**
   Record drill completion in the internal Ops log: Date, Dump Timestamp, Restore Duration, Restored Row Counts, Engineer Sign-Off.

---

## 5. Secret Management & Rotation Procedures

Secrets are injected at runtime via Doppler or Docker deployment environment variables. **Never commit secrets to git.**

### 5.1 Database Password Rotation (`DATABASE_URL`)
1. Create a secondary PostgreSQL user with identical schema grants:
   ```sql
   CREATE USER ncamart_app_v2 WITH PASSWORD '<NEW_SECURE_PASSWORD>';
   GRANT ncamart_app_role TO ncamart_app_v2;
   ```
2. Update `DATABASE_URL` in Doppler / staging environment.
3. Deploy rolling restart of `web_1`, then `web_2`, then `worker`.
4. Monitor application logs and `/api/v1/health` for connection stability.
5. After 24 hours, revoke and drop old database user:
   ```sql
   DROP USER ncamart_app_v1;
   ```

### 5.2 Application Encryption Key (`APP_ENCRYPTION_KEY`)
- `APP_ENCRYPTION_KEY` encrypts OTP secrets, supplier float balances, and runner credentials.
- `src/lib/crypto.ts` supports graceful rotation:
  1. Add `APP_ENCRYPTION_KEY_FALLBACK="<OLD_KEY>"` to environment.
  2. Set `APP_ENCRYPTION_KEY="<NEW_32_BYTE_HEX_KEY>"`.
  3. Deploy rolling update. Decryption succeeds via primary key or fallback key; all newly written records use the new key.
  4. Run background re-encryption script:
     ```bash
     pnpm tsx src/modules/identity/scripts/reencryptVault.ts
     ```
  5. Remove fallback key from environment after verification.

### 5.3 SSLCommerz Gateway Credentials
1. Generate new Store Password in the SSLCommerz Merchant Portal.
2. Update `SSLCOMMERZ_STORE_PASS` in Doppler / Compose environment.
3. Restart `web` and `worker` processes.
4. Perform a ৳10 sandbox test payment to verify IPN validation and query APIs.

### 5.4 Courier API Keys (Steadfast, Pathao, RedX)
1. Regenerate API Token in courier merchant dashboard.
2. Update `STEADFAST_API_KEY` / `PATHAO_CLIENT_SECRET` / `REDX_ACCESS_TOKEN`.
3. Restart `worker` process.
4. Verify courier booking queue does not report authentication errors (`401 Unauthorized`).

---

## 6. Incident Response Checklists

### Incident 1: Payment Mismatch (SSLCommerz IPN vs Gateway Query)
**Symptoms:** Customer account debited, but order remains `PENDING_PAYMENT`; or transaction amount does not match order total in paisa; or automated reconciliation alert in Sentry.

- [ ] **Step 1: Check Payment Transaction Record:**
  ```sql
  SELECT id, order_id, gateway, tran_id, val_id, amount_paisa, status, raw_ipn_payload
  FROM payment_transactions
  WHERE tran_id = '<TRAN_ID>';
  ```
- [ ] **Step 2: Query SSLCommerz Validation API Directly:**
  ```bash
  curl -G "https://securepay.sslcommerz.com/validator/api/validationserverAPI.php" \
    --data-urlencode "val_id=<VAL_ID>" \
    --data-urlencode "store_id=$SSLCOMMERZ_STORE_ID" \
    --data-urlencode "store_passwd=$SSLCOMMERZ_STORE_PASS" \
    --data-urlencode "v=1&format=json"
  ```
- [ ] **Step 3: Validate Amount in Integer Paisa:**
  - Verify `currency_amount * 100 == order.total_paisa`.
  - Check `currency == 'BDT'`.
  - Check `status == 'VALID' || status == 'VALIDATED'`.
- [ ] **Step 4: Manual Gateway Reconciliation Resolution:**
  - If payment is verified valid by SSLCommerz:
    Execute admin reconciliation transition via Admin UI (`POST /api/v1/payments/reconcile-manual`) or call `paymentsService.handleIpn()`.
  - If payment is fraudulent / unverified:
    Transition transaction to `FAILED`, mark order `PAYMENT_FAILED`, and alert Finance.

---

### Incident 2: Courier Provider Outage (Steadfast / Pathao / RedX)
**Symptoms:** Dispatch bookings failing; webhook delivery paused; outbox relay accumulating `courier.booking` events; DLQ alerts.

- [ ] **Step 1: Inspect Outbox Queue & Worker Health:**
  ```sql
  SELECT type, count(*), min(created_at) as oldest_pending
  FROM outbox
  WHERE published_at IS NULL
  GROUP BY type;
  ```
- [ ] **Step 2: Check Circuit Breaker Status:**
  - Review Sentry for courier error rates (> 10% failures in 5 min triggers breaker).
- [ ] **Step 3: Temporarily Route to Alternate Courier:**
  - Open Admin Dashboard $\to$ Settings $\to$ Logistics Routing.
  - Switch primary courier from down provider (e.g. Steadfast) to backup (Pathao or RedX).
- [ ] **Step 4: Retry Backlog on Recovery:**
  - Once courier confirms incident resolution, retry dead-letter jobs:
    ```bash
    pnpm tsx src/modules/logistics/scripts/retryFailedBookings.ts
    ```
- [ ] **Step 5: Run Courier Status Polling Fallback:**
  - Manually trigger `courier-status-polling` scheduled job to reconcile shipment updates missed during the outage.

---

### Incident 3: Cryptographic Clone Alert (Fraudulent Seal Verification)
**Symptoms:** Super Admin receives Class A alert: Crockford Base32 Seal ID scanned $\ge 5$ devices and $\ge 2$ districts within 24 hours.

- [ ] **Step 1: Query Seal Verification Audit Records:**
  ```sql
  SELECT seal_id, device_fingerprint, ip_address, district, verified_at, user_agent
  FROM seal_verifications
  WHERE seal_id = '<SEAL_ID>'
  ORDER BY verified_at DESC;
  ```
- [ ] **Step 2: Inspect Seal Record Status:**
  ```sql
  SELECT s.seal_id, s.status, s.cloned_flag, o.id as order_id, o.customer_phone
  FROM seal_records s
  JOIN order_items oi ON oi.id = s.order_item_id
  JOIN orders o ON o.id = oi.order_id
  WHERE s.seal_id = '<SEAL_ID>';
  ```
- [ ] **Step 3: Quarantine Compromised Seal:**
  - Call trust service quarantine:
    ```bash
    pnpm tsx -e "
      import { trustService } from './src/modules/trust';
      await trustService.quarantineClonedSeal('<SEAL_ID>', 'Confirmed cross-district clone detected');
    "
    ```
  - Quarantined seals immediately return a warning banner on `/verify/<SEAL_ID>` stating:  
    *⚠️ Warning: This seal has been flagged for multiple suspicious scans across different geographic locations. Please contact NCAMart Trust & Safety.*
- [ ] **Step 4: Contact Legitimate Buyer:**
  - Reach out to customer associated with the order to verify if product is in their possession or was resold/tampered.

---

### Incident 4: Database Connection Pool Exhaustion
**Symptoms:** HTTP 500 / 503 errors on `/api/v1/*`; `pg_isready` slow; healthcheck returns `db: error`.

- [ ] **Step 1: Check Active Postgres Connections:**
  ```sql
  SELECT count(*), state, application_name
  FROM pg_stat_activity
  GROUP BY state, application_name;
  ```
- [ ] **Step 2: Terminate Idle In-Transaction Queries:**
  ```sql
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE state = 'idle in transaction'
    AND state_change < now() - INTERVAL '5 minutes';
  ```
- [ ] **Step 3: Verify Pool Limits:**
  - Check `DATABASE_POOL_MAX` in `env.ts` (default 10 per container $\times$ 3 containers = 30 max connections).
  - Verify managed Postgres instance allows $\ge 100$ connections.

---

### Incident 5: Outbox Relay Lagging (> 5 Minutes)
**Symptoms:** Sentry or Better Stack alert: `ALERT: Outbox relay lag exceeds 5 minutes!`. Customer order confirmation SMS or emails delayed.

- [ ] **Step 1: Check Worker Container Health:**
  ```bash
  docker compose -f docker/compose.prod.yml ps worker
  docker compose -f docker/compose.prod.yml logs --tail=100 worker
  ```
- [ ] **Step 2: Check Redis Liveness & Memory:**
  ```bash
  docker compose -f docker/compose.prod.yml exec redis redis-cli -a "$REDIS_PASSWORD" info memory
  ```
- [ ] **Step 3: Restart Worker Process if Blocked:**
  ```bash
  docker compose -f docker/compose.prod.yml restart worker
  ```
- [ ] **Step 4: Monitor Catch-up:**
  ```sql
  SELECT count(*) FROM outbox WHERE published_at IS NULL;
  ```
