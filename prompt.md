# NCAMart — Backend-First Build Prompts

**Version:** 1.0  
**Date:** 2026-10-21  
**Built from:** [PRD.md](./PRD.md) v1.4 · [architechture.md](./architechture.md) v1.1 · [database.md](./database.md) v2.0 · [database-schema.md](./database-schema.md) v2.0 · [api-spec.md](./api-spec.md) v2.0  
**Scope:** Complete backend — Phase 1 + Phase 1.5 (all modules in the architecture). UI comes later, in the same repo.

---

## How to use this file (ব্যবহারের নিয়ম)

> **বাংলা নোট:** প্রতিটা নতুন AI session শুরু করার সময় আগে **P00 (Master Context)** prompt টা দিবেন, তারপর পরের prompt টা (P01, P02 …) **ক্রম অনুযায়ী একটা একটা করে** দিবেন। একটা prompt এর "Done when" checklist পুরোপুরি pass না হওয়া পর্যন্ত পরেরটায় যাবেন না। প্রতিটা prompt শেষে agent `docs/PROGRESS.md` আপডেট করবে — নতুন session এ সেটা দেখে কাজ continue করা যাবে।

1. Start every new AI session with **P00**. You can also copy P00 into `agent.md` so it loads automatically.
2. Run the prompts **in order**. Each one lists its dependencies.
3. Don't move to the next prompt until every item in "Done when" passes: `pnpm lint && pnpm typecheck && pnpm test`.
4. After each prompt the agent updates `docs/PROGRESS.md` and `docs/DECISIONS.md`.
5. If the agent finds a conflict in the docs, it follows the **precedence rules** in P00 and records the choice in `docs/DECISIONS.md`.

### Prompt map

| Stage | Prompts | Area |
| :--- | :--- | :--- |
| 0 — Foundation | P00–P04 | Context, scaffold, core libs, DB infrastructure, worker/outbox |
| 1 — Identity & RBAC | P05–P08 | Customers, staff, OTP, sessions, TOTP, RBAC, PII |
| 2 — Catalog & Search | P09–P12 | Categories, products, SKUs, governance, public catalog, Meilisearch |
| 3 — Suppliers & Inventory | P13–P14 | Suppliers, virtual stock, physical stock, reservations |
| 4 — Pricing, Promotions & Ledger | P15–P17 | Pricing engine, coupons, store credit, double-entry ledger |
| 5 — Orders, Checkout & Payments | P18–P22 | State machines, cart, checkout, SSLCommerz, invoices |
| 6 — Pre-Order Engine | P23 | Deposits, milestones, repricing, forfeiture |
| 7 — Sourcing & Runner | P24–P25 | Runner tasks, spot price, float, offline sync |
| 8 — Trust & QC | P26–P27 | Seals, QC, sampling, `/verify`, clone detection |
| 9 — Logistics | P28–P29 | Packing, courier adapters, webhooks, RTO, warranty start |
| 10 — Showroom POS | P30 | Pickup PIN, walk-in sales, cash drawer |
| 11 — RMA & Refunds | P31–P33 | Media uploads, warranty claims, refunds |
| 12 — Finance | P34–P35 | COD and gateway settlements, reports |
| 13 — Notifications & Realtime | P36–P37 | Class A/B/C notifications, SSE |
| 14 — Engagement & Growth | P38–P39 | Reviews, wishlist, abandoned cart, analytics, feeds |
| 15 — Admin, Security & Compliance | P40 | Staff admin, audit, retention, anonymization |
| 16 — Quality & Delivery | P41–P45 | Seeds, OpenAPI, test suites, Docker/CI, final audit |

---

## P00 — Master Context (paste at the start of every session)

```text
You are a senior backend engineer building NCAMart (ncamart.com), a high-trust, operations-heavy
e-commerce platform for tech accessories in Nawabpur, Dhaka, Bangladesh. We are building the
BACKEND FIRST: domain modules, REST API, background worker, database. NO UI pages yet
(only minimal placeholder pages if Next.js requires them).

SOURCE DOCUMENTS (repo root) — read the sections each prompt references before coding:
- PRD.md (v1.4)              → business rules, values, flows, RBAC matrix
- architechture.md (v1.1)    → stack, module boundaries, algorithms, jobs, ledger posting rules
- api-spec.md (v2.0)         → endpoint paths and request/response shapes
- database.md / database-schema.md → field-level reference ONLY

PRECEDENCE WHEN DOCUMENTS CONFLICT:
1. PRD.md wins for business rules and numeric values.
2. architechture.md wins for technical design (stack, algorithms, tables, jobs).
3. api-spec.md wins for endpoint paths and payload shapes, unless it contradicts 1 or 2.
4. database.md / database-schema.md are MongoDB/Mongoose-flavoured. IGNORE all Mongo/Mongoose
   code. Use them only as a field checklist and map everything to NORMALIZED PostgreSQL tables
   (no embedded arrays for items, sessions, addresses, scans, journal lines, etc.).
Record every conflict you resolve in docs/DECISIONS.md (one line: topic → choice → reason).

FIXED STACK (do not substitute):
- Node.js 22 LTS, pnpm, TypeScript strict ("strict": true, "noUncheckedIndexedAccess": true)
- Next.js 15 App Router in standalone mode; REST route handlers under src/app/api/v1/**
- PostgreSQL 16 + Drizzle ORM + drizzle-kit migrations (raw SQL migrations allowed for triggers,
  partitions and functions)
- Redis 7 (ioredis) for rate limits, OTP, cache, pub/sub, BullMQ queues
- BullMQ for jobs and repeatable schedules; a separate worker process (src/worker/index.ts)
- Meilisearch for search; Cloudflare R2 via the S3 API (@aws-sdk/client-s3); MinIO locally
- Zod for every input/output; OpenAPI generated from Zod (@asteasolutions/zod-to-openapi)
- argon2 (argon2id) for staff passwords; otplib for TOTP; AES-256-GCM for TOTP secrets at rest
- Vitest for unit tests; Testcontainers (Postgres + Redis) for integration tests
- Pino for structured logging; Sentry SDK hooks (no-op when the DSN is missing)

NON-NEGOTIABLE RULES:
1. Money is ALWAYS integer paisa (1 BDT = 100 paisa). Columns end in _paisa and use bigint
   (mode: 'number'). Never use floats for money. BDT only.
2. Percentages are stored as integer basis points (e.g. VAT 7.5% = 750 bp, spot buffer 5% = 500 bp).
3. Zero client-side financial trust: prices, discounts, deposits, fees and VAT are always computed
   on the server from DB records.
4. PostgreSQL is the source of truth. A business change, its ledger posting, its stock movement,
   its status-history row and its outbox event are written in ONE transaction.
5. External calls (SSLCommerz, couriers, SMS, WhatsApp, email, Meilisearch, analytics) NEVER run
   inside a DB transaction. They go through the transactional outbox → BullMQ jobs.
6. Explicit state machines: orders, payments, seals, refunds, claims, runner tasks and settlements
   only move through declared transitions. Illegal transitions → ERR_ILLEGAL_TRANSITION (409).
7. Append-only tables (journal_entries, journal_lines, stock_movements, seal_events,
   order_status_history, audit_logs) are protected by a DB trigger that rejects UPDATE/DELETE.
8. Module boundaries: src/modules/<module>/ exposes only service.ts functions plus events.ts types.
   Other modules never import another module's schema.ts or repo.ts (enforced by an ESLint rule).
9. Every staff mutation writes an audit_logs row. Every staff read of full customer PII writes an
   audit row. Runner endpoints use DTOs that physically contain no customer name/phone/address.
10. Idempotency-Key header is REQUIRED on: checkout, payment initiation, refunds (request/execute),
    POS sales/handover, runner sync. Store it in idempotency_keys (24h TTL); a replay returns the
    stored response; the same key with a different body → 422 ERR_IDEMPOTENCY_MISMATCH.
11. Timestamps are timestamptz stored in UTC. Business schedules use Asia/Dhaka (UTC+6, no DST).
12. Phone numbers: validate /^(?:\+8801|01)[3-9]\d{8}$/ and normalize to +8801XXXXXXXXX.
13. Seal IDs: Crockford Base32 'NCA-XXXX-XXXX', regex ^NCA-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$.
14. Secrets come only from environment variables validated by Zod at boot. Never commit secrets.
15. Every external provider has an interface plus a MOCK implementation selected by env, so the
    whole system runs locally with no real credentials.

API CONVENTIONS:
- Base path /api/v1. JSON uses snake_case keys (as in api-spec.md); TypeScript code uses camelCase;
  map at the DTO layer.
- Error envelope (all non-2xx):
  {"error":{"code":"ERR_...","message":"...","status":422,"details":{},"timestamp":"ISO"}}
  Status mapping: 400 validation, 401 unauthenticated, 403 forbidden, 404 not found,
  409 conflict/illegal transition/insufficient stock, 410 expired, 412 precondition (e.g. BTRC),
  422 business rule violation, 429 rate limited.
- Auth: cookie nca_sid (HttpOnly; Secure; SameSite=Lax; Path=/) OR "Authorization: Bearer <token>"
  for PWA/headless. Anonymous device cookie nca_did (random UUID, 2 years, first-party).
- Lists are paginated with page & limit (default 20, max 100) and return
  {"items"|<named>: [...], "pagination": {page, limit, total_count, total_pages}}.
- Every route handler goes through one wrapper (withRoute) that handles request IDs, Zod parsing,
  auth resolution, permission checks, error mapping and logging.

CANONICAL ENUMS (UPPER_SNAKE_CASE in the DB, used everywhere):
- Staff roles (a staff member may hold several): FIELD_RUNNER, QC_TECHNICIAN, GODOWN_MANAGER,
  DISPATCH_STAFF, SHOWROOM_POS_STAFF, SOURCING_MANAGER, CATALOG_MANAGER, CUSTOMER_SUPPORT,
  FINANCE_OFFICER, SUPER_ADMIN. Customers live in a separate customers table.
- Product tier: AUTHENTIC | BUDGET_SMART. Fulfillment type: REGULAR_DROP_PACK | PRE_ORDER.
- Product status: DRAFT → PENDING_REVIEW → APPROVED | REJECTED → PUBLISHED → ARCHIVED.
- Location codes: GODOWN_NAWABPUR, SHOWROOM_COUNTER (sellable); QC_HOLD, RMA_HOLD, DAMAGED,
  IN_TRANSIT (not sellable).
- Order type: REGULAR_DROP_PACK | PRE_ORDER. Fulfillment channel: COURIER | PICKUP | WALK_IN.
- Order statuses and payment statuses: exactly as PRD §3.12.
- Seal status: GENERATED, PRINTED, ACTIVE, VOID_PRINT_ERROR, CLAIMED, EXPIRED.
- Seal void reasons: PRINTER_JAM, RIBBON_TEAR, STICKER_DAMAGED (PRD wins over database.md).
- QC type: THREE_POINT | NON_INVASIVE | FULL_PRE_DISPATCH.
- Notification class: A | B | C.

WORKFLOW FOR EVERY PROMPT:
1. Read the referenced doc sections. Briefly restate the scope and list any doc conflicts.
2. Implement schema → migration → repo → service → policies → route handlers → jobs → tests.
3. Write unit tests for pure logic and integration tests (Testcontainers) for DB-level behaviour.
4. Run: pnpm lint && pnpm typecheck && pnpm test. Fix everything before reporting.
5. Update docs/PROGRESS.md (prompt ID, what was built, endpoints, jobs, tests, open TODOs) and
   docs/DECISIONS.md. Add new env vars to .env.example.
6. Don't implement features from later prompts. Leave clearly marked TODO(Pxx) hooks instead.
7. If a business value is unknown (e.g. per-kg surcharge), put it in the settings table with a
   sensible default and a TODO-CONFIRM note. Don't invent hard-coded values.
```

---

# STAGE 0 — FOUNDATION

## P01 — Repository Scaffold & Local Infrastructure

**Depends on:** P00 · **Docs:** architechture.md §2, §3, §4, §17.4

```text
Set up the NCAMart repository skeleton (backend-first).

1. Initialize Next.js 15 (App Router, TypeScript, src/ dir, no Tailwind for now) with pnpm in the
   current directory. Configure next.config.ts with output: 'standalone'.
2. Create this folder structure (empty index files where needed):
   src/app/api/v1/            (route handlers)
   src/app/feeds/             (feed routes, later)
   src/modules/{identity,catalog,inventory,orders,preorder,payments,ledger,logistics,sourcing,
                trust,rma,promotions,pos,finance,notifications,search,analytics,audit,media,
                engagement,settings}/
     each with: schema.ts, repo.ts, service.ts, events.ts, policies.ts, dto.ts, index.ts
   src/worker/index.ts, src/worker/jobs/, src/worker/schedules.ts
   src/lib/                   (shared infrastructure, see P02)
   src/db/                    (drizzle client, schema barrel, migrations/, sql/)
   src/test/                  (test helpers, Testcontainers setup, factories)
   docker/                    (Dockerfile.web, Dockerfile.worker, compose files, Caddyfile)
   docs/                      (PROGRESS.md, DECISIONS.md, API.md placeholder)
3. TypeScript strict config with path alias "@/*" → "src/*".
4. Tooling: ESLint (flat config) + Prettier; eslint-plugin-boundaries or no-restricted-imports
   rules that forbid importing "@/modules/<x>/schema" or "/repo" from outside module <x>
   (only index.ts / service.ts / events.ts / dto.ts may be imported across modules).
5. Vitest config with two projects: "unit" (*.test.ts) and "integration" (*.int.test.ts using
   Testcontainers for postgres:16 and redis:7). Add helpers to spin up the DB once per test file
   and run migrations.
6. docker/compose.dev.yml with: postgres:16, redis:7 (appendonly yes), getmeili/meilisearch,
   minio (+ bucket auto-create for ncamart-media, ncamart-private, ncamart-audit) and mailpit.
7. package.json scripts: dev, dev:worker (tsx watch src/worker/index.ts), build, start,
   start:worker, lint, typecheck, test, test:unit, test:int, db:generate, db:migrate, db:seed,
   db:studio, search:reindex, openapi:generate.
8. .env.example listing every variable used (DB, Redis, Meili, R2/S3, SSLCommerz, couriers,
   SMS/WhatsApp/email, Turnstile, Sentry, PostHog, encryption keys, APP_BASE_URL, NODE_ENV).
9. A health endpoint GET /api/v1/health → {status, db, redis, meili, version} (checks each
   dependency with a short timeout).
10. docs/PROGRESS.md with a table of all prompts P01–P45 and their status; docs/DECISIONS.md with
    the decisions already fixed in P00 (Postgres over Mongo, Next.js monolith, api-spec as the
    endpoint base, enum choices).

Done when: `docker compose -f docker/compose.dev.yml up -d` works, `pnpm dev` serves
/api/v1/health with all dependencies "ok", `pnpm dev:worker` starts and logs "worker ready",
and lint/typecheck/test pass (with one sample unit test and one sample integration test).
```

**Done when:**
- [ ] The health endpoint reports db/redis/meili as ok
- [ ] The boundary lint rule fails on a deliberate cross-module `repo` import (verify, then remove the import)
- [ ] The integration test container boots and migrations run

---

## P02 — Core Library (`src/lib`)

**Depends on:** P01 · **Docs:** architechture.md §1, §5, §6.2, §13.2; PRD §3.5, §3.6.6

```text
Build the shared infrastructure library in src/lib. Every piece needs unit tests.

1. env.ts — Zod-validated env loader; crash at boot with a clear message if invalid.
2. db.ts — Drizzle client (node-postgres Pool), `withTx(fn)` helper with SERIALIZABLE retry option
   and READ COMMITTED default; typed `Tx` type exported; `forUpdate()` helpers.
3. redis.ts — ioredis singletons (main, subscriber, BullMQ connection).
4. money.ts — Paisa branded type; takaToPaisa, paisaToTakaString (en: "৳1,200.00",
   bn: "৳১,২০০.০০" with Bangla numerals), addPaisa/sumPaisa, assertPaisa (non-negative integer),
   roundUpToTaka(paisa, takaStep), pctOfPaisa(paisa, bp, rounding: 'up'|'down'|'half_up').
   NO floating point anywhere — use integer math (BigInt internally where overflow is possible).
5. vat.ts — vatFromInclusive(grossPaisa, rateBp) → {netPaisa, vatPaisa} using
   vat = round_half_up(gross * rateBp / (10000 + rateBp)).
6. allocation.ts — largestRemainderAllocate(totalPaisa, weights[]) → integer parts that sum exactly
   to the total (used for coupon pro-rata allocation and COD splits).
7. phone.ts — validate + normalize BD MSISDN to +8801XXXXXXXXX; maskPhone ("017****5678").
8. time.ts — Dhaka helpers: nowUtc, toDhaka, startOfDhakaDay, addBusinessDays (Fri/Sat weekend,
   configurable holidays list from settings later), nextAllowedSendTime(class, now) exactly as
   architechture.md §13.2, fiscalYearOf(date) → "2026-2027" (July–June).
9. errors.ts — BusinessError(code, status, message, details), NotFoundError, ForbiddenError,
   ConflictError, RateLimitError; error code constants file (ERR_MIXED_CART_DISALLOWED,
   ERR_ILLEGAL_TRANSITION, ERR_INSUFFICIENT_STOCK, ERR_COD_NOT_ALLOWED, ERR_BTRC_CLEARANCE_REQUIRED,
   ERR_OTP_INVALID, ERR_OTP_EXPIRED, ERR_OTP_RATE_LIMIT, ERR_INVALID_PHONE, ERR_STAFF_AUTH_FAILED,
   ERR_INVALID_PIN, ERR_PIN_LOCKED, ERR_CANCELLATION_DISALLOWED, ERR_IDEMPOTENCY_MISMATCH,
   ERR_FORBIDDEN, ERR_UNAUTHENTICATED, ERR_VALIDATION, ERR_NOT_FOUND, ...). Keep it extensible.
10. http/route.ts — withRoute({ method, auth: 'public'|'customer'|'staff'|'any', permission?,
    body?, query?, params?, idempotent?: scope, rateLimit? }, handler). It must:
    generate/propagate x-request-id; parse with Zod (400 on failure with field errors);
    resolve the actor (stubbed until P06/P07 via an `ActorResolver` interface); enforce
    permissions (stub until P07); map errors to the envelope; log with pino.
11. idempotency.ts — table-backed (defined in P03): begin(key, scope, requestHash) → replay | proceed;
    complete(key, responseStatus, responseBody). Concurrency-safe (INSERT ... ON CONFLICT DO NOTHING
    + row lock), keys expire after 24h.
12. ratelimit.ts — Redis sliding-window limiter: check(key, limit, windowSec) → {allowed, remaining,
    retryAfterSec}; plus block(key, ttlSec) / isBlocked(key).
13. crypto.ts — randomToken(32 bytes, base64url), sha256Hex, hmacSha256(pepper), aesGcmEncrypt/Decrypt
    (key from env, versioned ciphertext "v1:iv:tag:data"), timingSafeEqualStr.
14. ids.ts — uuid v7 generator (time-sortable) for primary keys; human-readable number generator
    interface (implemented with DB counters in P03): ORD-YYYY-NNNNN, RMA-YYYY-NNNN,
    RUN-YYYYMMDD-NNNN, REF-YYYY-NNNNN, JRN-YYYYMMDD-NNNNN.
15. logger.ts (pino, redact phone/address/token fields), sentry.ts (no-op when DSN missing).
16. pagination.ts — parse page/limit, build the pagination meta.
17. storage.ts — S3 client for R2/MinIO: presignPut, presignGet (signed, short TTL),
    createMultipartUpload / presignUploadPart / completeMultipartUpload / abort, putObject, headObject.

Done when: all helpers have unit tests (money/vat/allocation/time edge cases incl. 22:00 and
07:59 Dhaka boundaries, fiscal year at 30 Jun/1 Jul, VAT 7.5%, allocation remainder),
and a sample route /api/v1/_debug/echo (dev only) proves withRoute validation + error envelope.
```

---

## P03 — Database Infrastructure Tables & Triggers

**Depends on:** P02 · **Docs:** architechture.md §5.4, §15.2, §15.3, §15.4; PRD §3.9 (audit)

```text
Create cross-cutting DB infrastructure (module: audit + settings + src/db/sql).

Tables (Drizzle + SQL migrations):
1. outbox(id uuid pk, type text, aggregate_type, aggregate_id, payload jsonb, notification_class
   char(1) null, available_at timestamptz default now(), created_at, published_at null,
   attempts int default 0, last_error text null). Partial index on (available_at) WHERE published_at IS NULL.
2. idempotency_keys(key text, scope text, request_hash text, response_status int null,
   response_body jsonb null, locked_at, created_at, expires_at) PK(key, scope).
3. audit_logs(id bigserial, staff_id uuid null, actor_type ('STAFF'|'SYSTEM'|'CUSTOMER'), action text,
   entity_type text, entity_id text, before_state jsonb, after_state jsonb, ip inet, user_agent,
   request_id, created_at, prev_hash char(64), hash char(64)). Hash chain:
   hash = sha256(prev_hash || canonical_json(row without hash)). Inserts take
   pg_advisory_xact_lock(<constant>) so the chain stays ordered. Provide audit.record(tx, entry)
   in modules/audit/service.ts and audit.verifyChain(from, to).
4. number_counters(scope text, period text, last_no bigint) PK(scope, period) — gapless counters
   via UPDATE ... RETURNING (INSERT ON CONFLICT for the first use). Implement nextNumber(tx, scope,
   period) and wire the ids.ts formatters to it. Mushak invoice serials will use scope 'MUSHAK_6_3'
   with period = fiscal year.
5. settings(key text pk, value jsonb, description, updated_by, updated_at) + typed accessor
   settings.get<K>() with Zod per key and 60s Redis cache. Seed defaults:
   PREORDER_COD_BALANCE_MAX_PAISA=3000000, DELIVERY_BASE_DHAKA_PAISA=8000,
   DELIVERY_BASE_OUTSIDE_PAISA=15000, DELIVERY_BASE_WEIGHT_GRAMS=1000,
   DELIVERY_SURCHARGE_PER_KG_PAISA=2000 (TODO-CONFIRM), RESERVATION_TTL_SECONDS=600,
   UNPAID_ORDER_CANCEL_HOURS=24, SPOT_BUFFER_DEFAULT_BP=500, MIN_MARGIN_BP=1500,
   RUNNER_PURCHASE_APPROVAL_THRESHOLD_PAISA=200000, REFUND_LIMIT_SUPPORT_PAISA=100000,
   REFUND_LIMIT_FINANCE_PAISA=2000000, GOODWILL_CREDIT_EXPIRY_MONTHS=12,
   PREORDER_DELAY_CREDIT_PAISA=100000, QC_SAMPLING_BP=500, QC_SAMPLING_SLA_MINUTES=120,
   PICKUP_PIN_VALID_DAYS=7, PICKUP_PIN_MAX_ATTEMPTS=5, SUPPLIER_DEFECT_SUSPEND_BP=300,
   BUSINESS_HOLIDAYS=[], MARKETING_QUIET_START="22:00", MARKETING_QUIET_END="08:00".
6. A generic forbid_mutation() trigger function (architechture.md §15.2) and a helper migration
   macro to attach it to a table. Apply it to audit_logs now; later prompts apply it to their
   append-only tables.
7. Create a DB role plan in docs (app role has INSERT/SELECT only on append-only tables) and a
   migration that creates role ncamart_app with those grants (idempotent; skipped if it exists).

Tests (integration):
- UPDATE/DELETE on audit_logs throws "append-only table".
- 50 concurrent audit inserts keep a valid hash chain; verifyChain detects a tampered row
  (tamper by disabling the trigger as superuser inside the test).
- number_counters gives gapless unique numbers under 100 concurrent calls.
- Idempotency: the same key + same body replays; the same key + different body → 422.
```

---

## P04 — Worker, Queues, Outbox Relay & Scheduler

**Depends on:** P03 · **Docs:** architechture.md §2, §13.1, §15.3, §16, §17.5

```text
Build the background worker process (src/worker).

1. Queue registry (src/lib/queues.ts): named BullMQ queues — outbox-dispatch, notifications,
   courier, payments, search, analytics, media, finance, maintenance — with default job options
   (attempts, exponential backoff, removeOnComplete limits). Export typed enqueue helpers.
2. Outbox relay: a loop polling every 1s that selects unpublished rows
   (available_at <= now()) with FOR UPDATE SKIP LOCKED LIMIT 100, routes each event type to one
   or more queues via an event→handler registry (each module registers its handlers in its
   events.ts), enqueues with jobId = outbox.id (dedupe), and sets published_at. On Redis failure,
   rows stay unpublished and are retried. Write outbox.emit(tx, type, payload, opts) in
   modules/audit or lib/outbox.ts for use inside business transactions.
3. Scheduler (src/worker/schedules.ts): register repeatable jobs using Asia/Dhaka cron patterns
   (tz option). Create a registry where later prompts add jobs; for now register only:
   - outbox health check (every 1 min: alert if the oldest unpublished event is > 5 min old)
   - idempotency key cleanup (daily 04:30)
   Each scheduled job calls heartbeat(jobName) → pings a Better Stack URL from env if set
   (no-op otherwise) and stores last_run_at in Redis.
4. Dead-letter handling: jobs exhausting retries are moved to a "dead-letter" queue and logged;
   provide a service function to list and retry dead-letter jobs (an admin endpoint comes in P40).
5. Graceful shutdown (SIGTERM): stop the relay, close workers, drain.
6. A lightweight in-process event bus test harness so integration tests can run the relay
   synchronously (drainOutbox()).

Tests: an outbox event emitted inside a rolled-back transaction is never published; a committed
event is published exactly once even if the relay runs twice concurrently; dedupe by jobId works.
```

---

# STAGE 1 — IDENTITY, SESSIONS & RBAC

## P05 — Identity Schema & Bangladesh Geo Data

**Depends on:** P04 · **Docs:** PRD §3.5, §3.7 (address structure), §7 (Customer, Address, Staff, Session); architechture.md §6

```text
Create identity tables (module: identity) and geo reference data.

Tables:
1. customers(id, phone unique, full_name null, email null (lowercase), email_verified bool,
   status ('ACTIVE'|'FROZEN'|'ANONYMIZED'), delivered_order_count int, rto_count_12m int,
   cod_blocked bool, cod_block_reason, cod_block_lifted_by, marketing_opt_in bool,
   marketing_opt_in_at, preferred_locale ('bn'|'en'), last_active_at, previous_customer_id null
   (link when a recycled-number account is split), created_at, updated_at).
2. customer_addresses(id, customer_id fk, label ('HOME'|'OFFICE'|'OTHER'), consignee_name,
   contact_phone, division_id, district_id, thana_id, area_id null, address_line, is_default,
   created_at, updated_at, deleted_at). Partial unique index: one default per customer.
3. geo_divisions, geo_districts, geo_thanas, geo_areas (id, parent fk, name_en, name_bn,
   is_inside_dhaka bool on thana level). Seed all 8 divisions, 64 districts and Dhaka city thanas
   (mark Dhaka metro thanas is_inside_dhaka=true); put the seed data in src/db/seed/geo/*.json.
   Leave other thanas loadable from a JSON file (document where to get them).
4. courier_location_map(courier ('STEADFAST'|'PATHAO'|'REDX'), geo_level, geo_id,
   courier_location_id, courier_location_name) unique(courier, geo_level, geo_id).
5. staff(id, full_name, email unique, phone unique, password_hash, totp_secret_enc null,
   totp_enabled bool, status ('ACTIVE'|'SUSPENDED'), must_change_password bool,
   last_login_at, created_at, updated_at).
6. staff_roles(staff_id, role) PK(staff_id, role) — role enum from P00.
7. sessions(id, token_hash char(64) unique, subject_type ('CUSTOMER'|'STAFF'), subject_id,
   device_id, device_label, ip, user_agent, ownership_unconfirmed bool default false,
   created_at, last_seen_at, expires_at, revoked_at null, revoked_by null).
8. customer_ownership_challenges(id, session_id, customer_id, method ('EMAIL_OTP'|'SUPPORT'),
   status, created_at, resolved_at, resolved_by).

Also: Drizzle relations, indexes (customers.phone, sessions.token_hash, sessions(subject_type,
subject_id)), and GET /api/v1/geo/divisions|districts?division_id=|thanas?district_id=|areas?thana_id=
(public, cached 24h).

Tests: unique phone, one default address per customer, geo endpoints return Bangla + English names.
```

---

## P06 — Customer Phone OTP Auth, Sessions & Device ID

**Depends on:** P05 · **Docs:** PRD §3.5; architechture.md §6.1, §6.2, §7.4; api-spec §1.1, §1.2, §2.1, §2.2, §2.4, §2.5

```text
Implement customer authentication (module: identity).

1. Device ID: Next.js middleware sets nca_did (random UUID, 2-year, HttpOnly, Secure, Lax) if
   missing. Middleware ONLY checks cookie presence; real auth happens in withRoute.
2. POST /api/v1/auth/otp/send {phone, captcha_token?}
   - Normalize the phone (400 ERR_INVALID_PHONE).
   - Rate limits: 3 sends / 10 min per phone, 20 / hour per IP → 429 ERR_OTP_RATE_LIMIT and a
     1-hour cooldown key. Verify Cloudflare Turnstile (mock verifier in dev) when the IP is
     near its limit or when captcha is forced by settings.
   - OTP = crypto.randomInt(100000, 1000000); store sha256(otp + pepper) in Redis key otp:{phone}
     with 180s TTL and attempts=0. Emit outbox 'auth.otp_requested' (Class A SMS; the template
     is used in P36; until then a mock provider logs it).
   - Response as api-spec §2.1 (expires_in_seconds 180, retry_after_seconds 60).
3. POST /api/v1/auth/otp/verify {phone, otp_code, device_id?}
   - Max 3 attempts per OTP → invalidate the OTP after the 3rd failure. Errors: 401 ERR_OTP_INVALID
     with remaining attempts, 410 ERR_OTP_EXPIRED.
   - Find or create the customer. Guest merge: orders placed as guest under the same verified
     phone are already linked by customer_id (a guest checkout creates a customer row on OTP
     verification) — document this.
   - Dormancy rule (PRD §3.5): if last_active_at is older than 12 months → create the session with
     ownership_unconfirmed=true and return "ownership_confirmation_required": true. While
     unconfirmed, order history, addresses, warranties and store credit endpoints return 403
     ERR_OWNERSHIP_UNCONFIRMED.
   - Create the session: random 32-byte token; store sha256; set cookie nca_sid (30-day sliding
     expiry; extend last_seen_at/expires_at at most once per hour); also return session_token
     in the body for Bearer clients (api-spec §2.2).
4. Ownership confirmation:
   - POST /api/v1/auth/ownership/email-otp/send and /verify (only if the customer has a verified email).
   - If unconfirmed → support flow (P40 endpoint) can confirm OR split: create a new customer for
     the phone, freeze the old one (status FROZEN, previous_customer_id link), audit-logged.
5. Session resolution in withRoute: read the cookie or Bearer token → sha256 → Redis cache (60s) →
   DB; reject revoked/expired; attach actor {type:'CUSTOMER', id, sessionId, ownershipUnconfirmed}.
   Update customers.last_active_at at most once per day.
6. POST /api/v1/auth/logout — revoke the current session, clear the cookie, bust the cache.
7. GET /api/v1/auth/sessions, DELETE /api/v1/auth/sessions/:sessionId — list/revoke own sessions
   (device_label derived from user agent, is_current flag).
8. Phone change: POST /api/v1/customer/phone-change/send {new_phone} and /verify {new_phone,
   otp_code} — new number must not belong to another active account; moves the account; revokes
   other sessions; audit row (actor CUSTOMER).

Tests: OTP happy path; 3 wrong attempts invalidate; TTL expiry → 410; rate limits per phone and
per IP; dormancy creates an unconfirmed session and hides data; revoked session rejected
immediately (cache busted); phone change conflict.
```

---

## P07 — Staff Auth (Password + TOTP), RBAC Permissions & PII Serializers

**Depends on:** P06 · **Docs:** PRD §3.9 (full matrix), §3.18; architechture.md §6.2, §6.3; api-spec §2.3, §17

```text
Implement staff authentication and authorization (modules: identity, audit).

1. Staff login: POST /api/v1/auth/staff/login {identifier (email or phone), password, totp_code}.
   - argon2id verify (constant-time behaviour for unknown users), TOTP verify (otplib, window ±1).
   - If totp_enabled=false (first login after creation) → return 200 with
     {"totp_enrollment_required": true, enrollment_token} and nothing else.
   - POST /api/v1/auth/staff/totp/enroll {enrollment_token} → otpauth URL + secret (stored
     AES-GCM encrypted, not yet enabled); POST /api/v1/auth/staff/totp/confirm {enrollment_token,
     totp_code} → enables TOTP and creates the session.
   - Staff sessions: 12-hour absolute expiry, no sliding. Login rate limit: 5 failures / 15 min per
     identifier and 30 / hour per IP. Audit every login success and failure.
   - POST /api/v1/auth/staff/password/change.
2. Permission catalogue (src/modules/identity/permissions.ts): define permission strings that
   cover EVERY row of the PRD §3.9 matrix, e.g.
   catalog.read, order.place, runner.task.own, runner.task.read, runner.task.assign,
   sourcing.price.input, sourcing.price.override, qc.execute, seal.print, qc.sampling.audit,
   seal.void.approve, dispatch.pack, dispatch.book, returns.receive, stock.adjust.request,
   stock.adjust.approve, pos.operate, drawer.count, drawer.reconcile, pii.read.full,
   pii.read.shipping, pii.read.counter, pii.read.billing, spot.override.approve,
   rma.adjudicate, refund.approve (amount-limited), refund.execute, store_credit.issue
   (amount-limited), catalog.draft, catalog.publish, coupon.draft, coupon.activate,
   float.own, float.read, float.manage, settlement.reconcile, ledger.read, reports.export,
   staff.manage, audit.read, settings.manage, security.alerts.read, queues.admin.
   Map role → permissions exactly as the matrix (permissions are additive across roles).
   SUPER_ADMIN has all.
3. assertCan(actor, permission, context?) in policies; amount-limited permissions read limits
   from settings (Support ≤ ৳1,000; Finance ≤ ৳20,000; Super Admin unlimited). Wire it into
   withRoute's `permission` option and expose it for service-level checks.
4. PII serializers (src/modules/identity/pii.ts): role-specific DTO builders for customer data:
   FULL (support/admin; writes an audit 'pii.read' row), SHIPPING (dispatch: name, phone,
   address), COUNTER (POS: name, masked phone), BILLING (finance: name, BIN, invoice fields),
   MASKED (runner/QC/GM/SM: no name/phone/address at all — the type must not even have those
   fields). Add a unit test asserting the runner DTO type has no PII keys.
5. Bootstrap command: pnpm staff:create-admin --email --phone --name → creates the first
   SUPER_ADMIN with a one-time password (printed once, must_change_password=true).
6. Staff session remote revoke: POST /api/v1/admin/staff/:id/sessions/revoke (SUPER_ADMIN).

Tests: login without TOTP fails; enrollment flow; role → permission matrix snapshot test that
mirrors PRD §3.9; refund approval limit checks; PII masking per role; every staff mutation in
tests produces an audit row (add a test helper that asserts this).
```

---

## P08 — Customer Profile, Addresses & My Warranties (stub)

**Depends on:** P07 · **Docs:** api-spec §3; PRD §3.5, §3.6.2

```text
Implement customer self-service endpoints (module: identity).

1. GET /api/v1/customer/profile → api-spec §3.1 shape, plus store_credit_balance_paisa (0 until P16),
   marketing_opt_in, preferred_locale, and risk_profile.cod_eligibility:
   'FULL_COD' | 'ADVANCE_FEE_REQUIRED' | 'COD_BLOCKED' computed by a pure function
   codEligibility({deliveredCount, rtoCount12m, codBlocked}) (architechture.md §9.3):
   delivered >= 1 && rto == 0 → FULL_COD; rto >= 2 || codBlocked → COD_BLOCKED; else
   ADVANCE_FEE_REQUIRED. Put this function in modules/orders/policies or lib so checkout reuses it.
2. PUT /api/v1/customer/profile {full_name?, email?, preferred_locale?, marketing_opt_in?}
   (email changes require email verification → send a code by email; mark verified on confirm).
3. Addresses: GET/POST /api/v1/customer/addresses, PUT/DELETE /api/v1/customer/addresses/:id,
   POST /api/v1/customer/addresses/:id/default. Validate the geo hierarchy (thana belongs to the
   district, etc.). Return is_inside_dhaka for each address.
4. GET /api/v1/customer/warranties → empty list for now with a TODO(P26) hook; final shape as
   api-spec §3.3.
5. All of these return 403 ERR_OWNERSHIP_UNCONFIRMED when the session is unconfirmed.

Tests: COD eligibility truth table (0/0 → advance; 1/0 → full; 3/1 → advance; x/2 → blocked;
blocked flag → blocked); address geo validation; default address switching.
```

---

# STAGE 2 — CATALOG & SEARCH

## P09 — Catalog Schema (Categories, Spec Templates, Products, SKUs, Comparison Groups, Media)

**Depends on:** P08 · **Docs:** PRD §3.0, §3.1, §3.15, §7 (Product, SKU); database-schema §1.2–1.4

```text
Create catalog tables (module: catalog; media asset table in module: media).

1. categories(id, parent_id null, slug unique, name_en, name_bn, level 1-3, sort_order,
   default_fulfillment_type, btrc_clearance_required bool, is_active).
2. category_spec_fields(id, category_id, key_name, label_en, label_bn, unit null,
   field_type ('NUMBER'|'STRING'|'BOOLEAN'|'ENUM'), enum_options jsonb null, is_required,
   is_highlighted_for_comparison, sort_order) unique(category_id, key_name).
   Seed templates from PRD §3.1.3 (Chargers/Power, Cables, Audio, common fields).
3. brands(id, name, slug unique, is_authorized_distribution bool, official_distributor_name null).
4. comparison_groups(id, name, category_id, verdict_en, verdict_bn, badge_authentic_label
   default 'Full Safety Suite', badge_budget_label default 'Best Everyday Value').
5. products(id, slug unique, title_en, title_bn, description_en, description_bn, category_id,
   brand_id null, product_tier, fulfillment_type, comparison_group_id null, origin_country,
   hs_code null, btrc_status ('NOT_REQUIRED'|'PENDING'|'APPROVED'|'REJECTED'),
   btrc_clearance_code null, vat_rate_bp int, status (lifecycle enum), zero_replica_attested bool,
   zero_replica_attested_by, distributor_evidence_media_id null, comparison_points_en text[],
   comparison_points_bn text[], seo_title, seo_description, preorder_eta_days_min/max null,
   preorder_batch_threshold int null, created_by, submitted_by, reviewed_by, review_notes,
   published_at, archived_at, created_at, updated_at).
   CHECK: tier BUDGET_SMART requires zero_replica_attested before status PUBLISHED (enforced in
   service; also a DB CHECK when status='PUBLISHED').
6. skus(id, product_id, sku_code unique uppercase, barcode_ean13 null, attributes jsonb, specs jsonb,
   price_paisa (VAT-inclusive list price), compare_at_price_paisa null, base_cost_paisa,
   spot_buffer_bp (500..700, default from settings), max_unit_purchase_paisa (computed column or
   stored: base_cost * (1 + buffer)), warranty_days, warranty_type ('SHOP_REPLACEMENT'|
   'OFFICIAL_DISTRIBUTOR'|'MANUFACTURER_GLOBAL'), official_distributor_name, weight_grams,
   daily_order_cap null, is_active, created_at, updated_at).
   Validate specs against category_spec_fields in the service (Zod built dynamically).
7. media_assets(id, owner_type, owner_id, kind ('PRODUCT_IMAGE'|'DISTRIBUTOR_EVIDENCE'|
   'RECEIPT_PHOTO'|'QC_PHOTO'|'RMA_PHOTO'|'RMA_VIDEO'|'REFUND_PROOF'|'INVOICE_PDF'|'OTHER'),
   bucket, storage_key, content_type, size_bytes, width, height, duration_seconds,
   status ('PENDING_UPLOAD'|'READY'|'DELETED'), is_public bool, sort_order, is_primary,
   retention_until null, uploaded_by_type, uploaded_by_id, created_at).
8. product_status_history (append-only: product_id, from, to, actor, notes, created_at).

Drizzle relations + indexes (products(category_id, product_tier, status),
products(comparison_group_id), skus(product_id)). Attach forbid_mutation to product_status_history.

Tests: slug/sku uniqueness, CHECK on BUDGET_SMART publish without attestation, spec validation
against the category template.
```

---

## P10 — Catalog Governance APIs (Draft → Review → Publish, BTRC Guard)

**Depends on:** P09 · **Docs:** PRD §3.1, §3.3.3, §3.15; api-spec §15.1, §15.2

```text
Implement staff catalog management (module: catalog). All mutations are audit-logged.

Endpoints (prefix /api/v1/admin/catalog):
- Categories & spec fields: CRUD (catalog.draft to create/edit; SUPER_ADMIN to delete).
- Brands, comparison groups: CRUD (catalog.draft).
- POST /products (CATALOG_MANAGER) — create a DRAFT with SKUs (api-spec §15.1 body). Returns
  {product_id, status:'DRAFT'}.
- PUT /products/:id, PUT /products/:id/skus/:skuId, POST /products/:id/skus — only while
  DRAFT or REJECTED (editing a PUBLISHED product creates a revision: allow price/stock-related
  SKU fields (price, base_cost, spot_buffer, daily cap) to be edited by catalog.draft with an
  audit row; structural edits require moving back to DRAFT → re-review).
- POST /products/:id/submit — DRAFT/REJECTED → PENDING_REVIEW. Run the review checklist
  (PRD §3.15.2) and return all failures together:
  BUDGET_SMART: zero_replica_attested + at least one real-packaging photo;
  AUTHENTIC: distributor evidence media present;
  category.btrc_clearance_required: hs_code present and btrc_status set;
  tier, fulfillment type, VAT rate, weight on every SKU, comparison group (warn only if none).
- POST /products/:id/approve | /reject {notes} — SUPER_ADMIN only, and the reviewer must not be
  the creator/submitter (four-eyes → 403 ERR_FOUR_EYES_VIOLATION).
- POST /products/:id/publish — SUPER_ADMIN; requires APPROVED; BTRC guard: if the category requires
  BTRC and (btrc_status != 'APPROVED' or no clearance code) → 412 ERR_BTRC_CLEARANCE_REQUIRED.
  Emits outbox 'catalog.product_published' (search index, feeds, back-in-stock later).
- POST /products/:id/archive | /unarchive.
- POST /products/:id/media/upload-url → presigned PUT for images (JPG/PNG/WebP, ≤10 MB), then
  POST /products/:id/media/:mediaId/complete (headObject to verify size/type) → READY.
- GET /products (staff list with filters status/tier/category/q), GET /products/:id (full).

Product status transitions are declared as data and enforced by one function (same pattern as
orders). Every transition writes product_status_history.

Tests: four-eyes rule; BTRC 412; checklist failures aggregated; published products are immutable
except allowed pricing fields; image upload validation.
```

---

## P11 — Public Catalog APIs (Browse, Detail, Compare, Availability)

**Depends on:** P10 (inventory availability completed in P14) · **Docs:** PRD §3.1, §3.11.4; api-spec §4.1–4.3; PRD §6 (SEO)

```text
Implement the public catalog read APIs (module: catalog). Only PUBLISHED products and active SKUs.

1. GET /api/v1/catalog/categories — tree with name_en/name_bn, counts of published products.
2. GET /api/v1/catalog/products — filters: category (slug, includes descendants), tier, brand,
   fulfillment (REGULAR_DROP_PACK|PRE_ORDER), price_min_paisa, price_max_paisa, availability
   (IN_STOCK|AVAILABLE|ANY), sort (PRICE_ASC|PRICE_DESC|NEWEST), page, limit. Response shape as
   api-spec §4.1 plus tier_badge {code, label_en, label_bn} and availability_label.
3. GET /api/v1/catalog/products/:slug — product, SKUs (price, attributes, specs rendered with
   template labels/units), media (public CDN URLs), tier badge, warranty label, comparison group
   id, availability per SKU, preorder info (ETA range, deposit preview per SKU using the deposit
   function from P15 — leave TODO(P15) and return null for now), JSON-LD-ready fields
   (brand, gtin, offers).
4. GET /api/v1/catalog/compare/:comparisonGroupId — api-spec §4.3 shape. Build the spec diff from
   the category template's highlighted fields; include price, warranty label and value badges.
5. Availability service (interface now, real implementation in P14):
   getSkuAvailability(skuIds) → { skuId: 'IN_STOCK' | 'AVAILABLE' | 'OUT_OF_STOCK', physicalQty }
   Labels (PRD §3.11.4): "In stock — ships today" / "Available — ships within 24h" / "Out of stock"
   (bn + en). PRE_ORDER SKUs show 'PRE_ORDER'.
6. Caching: Redis cache per product slug and list query (5 min), busted by the
   'catalog.product_published|updated|archived' events. Set Cache-Control headers suitable for CDN.

Tests: unpublished products are invisible; category descendants filter; compare diff uses
template order; cache invalidation on update.
```

---

## P12 — Search (Meilisearch: Bangla, English, Banglish)

**Depends on:** P11 · **Docs:** PRD §3.16.1; architechture.md §14; api-spec §4.4

```text
Implement search (module: search).

1. Index "products" document: id, slug, title_en, title_bn, brand, category path names (en/bn),
   tier, fulfillment_type, min_price_paisa, availability, spec keywords, sku codes, published_at.
   Settings: searchable attributes order, filterable (tier, category_ids, brand, fulfillment_type,
   availability, min_price_paisa), sortable (min_price_paisa, published_at), typo tolerance on.
2. Synonyms file src/modules/search/synonyms.ts (bn ↔ en ↔ Banglish), e.g.
   চার্জার↔charger↔charjar, ক্যাবল↔cable↔kebol, পাওয়ার ব্যাংক↔power bank↔powerbank,
   হেডফোন↔headphone, ইয়ারবাড↔earbuds↔airbuds, মাল্টিমিটার↔multimeter, স্মার্ট লক↔smart lock.
   Also normalize Bangla digits to Latin in queries ("৬৫ ওয়াট" → "65 w").
3. Outbox handlers for catalog.product_published/updated/archived and inventory availability
   changes → upsert/delete documents (queue: search).
4. pnpm search:reindex — full rebuild from Postgres into a new index, then atomic swap.
5. GET /api/v1/catalog/search?q=&tier=&category=&brand=&page=&limit= → hits with
   _formatted highlights, facets (tier, brand, category), pagination. Fall back to a Postgres
   ILIKE query if Meilisearch is down (log a warning).

Tests (integration with the Meili container): Bangla query finds the English-titled product via
synonyms; typo "chrager" finds charger; filters work; reindex swap is atomic.
```

---

# STAGE 3 — SUPPLIERS & INVENTORY

## P13 — Suppliers, Stalls & Virtual Stock

**Depends on:** P12 · **Docs:** PRD §3.4.1, §3.4.4, §3.11.1, §7 (Supplier, SupplierStock), §10 (batch defect)

```text
Implement suppliers and virtual stock (module: sourcing).

Tables:
1. suppliers(id, name, proprietor_name, market ('NAWABPUR_COMPLEX'|'SUNDARBAN_SQUARE'|
   'STADIUM_MARKET'|'PATUATULI'|'IMPORT'), stall_no, floor, phone, bkash_merchant_number null,
   accepted_payment_modes text[] ('CASH'|'BKASH'|'SUPPLIER_CREDIT'), status ('ACTIVE'|'SUSPENDED'),
   suspended_reason, total_units_sourced int, qc_failed_units int, defect_rate_bp int,
   created_at, updated_at).
2. supplier_stock(supplier_id, sku_id, status ('AVAILABLE'|'LIMITED'|'OUT'), daily_order_cap null,
   last_quoted_cost_paisa null, priority int (1 = primary), confirmed_at, confirmed_by)
   PK(supplier_id, sku_id).
3. supplier_qc_batches(id, supplier_id, runner_task_id null, units_total, units_failed,
   outcome ('ACCEPTED'|'RETURNED'), created_at) — rule: if ≥3 of 5 units in a batch fail QC,
   the whole batch is returned (PRD §10).

Services & endpoints (/api/v1/admin/suppliers, SOURCING_MANAGER; read for GODOWN_MANAGER):
- CRUD suppliers; suspend/reactivate (audit).
- PUT /api/v1/admin/suppliers/:id/stock (bulk daily status confirmation for many SKUs).
- GET /api/v1/admin/sourcing/sku/:skuId/suppliers — ordered primary/backup list.
- recordQcOutcome(supplierId, passed, failed) updates the counters and defect_rate_bp; if
  defect_rate_bp > SUPPLIER_DEFECT_SUSPEND_BP (3%) with at least 20 units sourced → auto-suspend
  and emit 'supplier.suspended' (Class A internal alert).
- Virtual availability: a SKU is virtually AVAILABLE if any ACTIVE supplier has AVAILABLE or
  LIMITED (and the LIMITED daily cap is not reached today — count today's confirmed orders that
  sourced this SKU virtually).
- Daily stale-status job (08:00): mark supplier_stock rows not confirmed in the last 24h as stale
  (treated as LIMITED) and notify the Sourcing Manager.

Tests: defect auto-suspension, daily cap enforcement, primary/backup ordering, batch 3-of-5 rule.
```

---

## P14 — Physical Inventory, Movements & 10-Minute Reservations

**Depends on:** P13 · **Docs:** PRD §3.6.3, §3.11; architechture.md §8.1, §8.2; database.md §7

```text
Implement physical inventory (module: inventory). This is concurrency-critical.

Tables:
1. locations(id, code unique (canonical codes from P00), name, is_sellable bool). Seed all six.
2. inventory_balances(sku_id, location_id, on_hand int, reserved int, safety_stock int,
   updated_at) PK(sku_id, location_id), CHECK (reserved >= 0 AND on_hand >= reserved).
3. stock_movements(id, sku_id, from_location_id null, to_location_id null, qty > 0, reason
   ('PURCHASE_RECEIPT'|'RUNNER_RECEIPT'|'RUNNER_CONFLICT_RECEIPT'|'SALE'|'POS_SALE'|'TRANSFER'|
   'RTO_RETURN'|'RMA_RETURN'|'CANCELLATION_RECEIPT'|'PREORDER_FORFEIT_RECEIPT'|'SUPPLIER_RETURN'|
   'WRITE_OFF'|'CYCLE_COUNT_ADJUSTMENT'|'QC_HOLD'|'QC_RELEASE'), ref_type, ref_id,
   unit_cost_paisa, staff_id null, created_at). Append-only trigger.
4. stock_reservations(id, order_id, order_item_id, sku_id, location_id, qty, status
   ('ACTIVE'|'COMMITTED'|'RELEASED'), expires_at, created_at, committed_at, released_at).
   Index (status, expires_at), (order_id).
5. stock_adjustment_requests(id, sku_id, location_id, delta, reason, requested_by, status
   ('PENDING'|'APPROVED'|'REJECTED'), approved_by, approved_at, notes).
6. cycle_counts(id, location_id, status, started_by, completed_at) + cycle_count_lines(count_id,
   sku_id, system_qty, counted_qty, variance).

Service functions (all take a tx):
- receive(tx, {skuId, locationCode, qty, unitCost, reason, ref}) → on_hand += qty + movement.
- transfer(tx, {skuId, from, to, qty, reason, ref}).
- reserve(tx, {orderId, orderItemId, skuId, qty, locationPreference[]}) — EXACT SQL pattern from
  architechture.md §8.2 (conditional UPDATE ... WHERE on_hand - reserved >= qty RETURNING), try
  locations in preference order; insert the reservation with expires_at = now() + TTL setting.
  Returns the reservations or null when there isn't enough stock.
- commit(tx, reservationId) — UPDATE ... SET status='COMMITTED' WHERE id=$1 AND status='ACTIVE';
  if 1 row → on_hand -= qty, reserved -= qty, movement SALE; return true. If 0 rows → false
  (the caller handles re-reserve / virtual fallback / refund).
- release(tx, reservationId | orderId).
- expireReservations() job every 1 min — EXACT CTE from architechture.md §8.2.
- allocate(orderType, channel, lines) — allocation rule (PRD §3.11.3): courier orders →
  GODOWN_NAWABPUR then SHOWROOM_COUNTER; pickup orders → SHOWROOM_COUNTER then GODOWN; then virtual
  (P13); else not purchasable. Returns per-line {source:'PHYSICAL'|'VIRTUAL', locationCode?}.
  PRE_ORDER SKUs never allocate physical stock unless they are flash-deal physical units.
- availability(skuIds) — implements the P11 interface: physical sellable (on_hand - reserved) > 0 →
  IN_STOCK; else virtual → AVAILABLE; else OUT_OF_STOCK. Emits 'inventory.availability_changed'
  when a SKU flips state (search reindex).
- Adjustments: GODOWN_MANAGER requests (stock.adjust.request), FINANCE_OFFICER approves
  (stock.adjust.approve) → movement + ledger posting hook TODO(P17) for write-offs.
- Nightly job 03:30: verify on_hand == sum(movements in) − sum(movements out) per (sku, location);
  report mismatches as a Class A internal alert.

Endpoints (/api/v1/admin/inventory): balances list/filter, movements list, receive (GM),
transfer (GM), adjustment request/approve/reject, cycle count start/submit lines/complete.

Integration tests (critical):
- 20 parallel reserve() calls for the last 3 units → exactly 3 succeed, no negative stock.
- commit vs expiry race: run commit and expireReservations concurrently 100× → each reservation
  ends either COMMITTED or RELEASED, never both, and balances stay consistent.
- Append-only movements; nightly check catches a manual balance tamper.
```

---

# STAGE 4 — PRICING, PROMOTIONS & LEDGER

## P15 — Pricing Engine (Pure Functions)

**Depends on:** P14 · **Docs:** PRD §3.3.2, §3.4.2, §3.6.2, §3.6.4, §3.7 (fees), §3.14.5, §3.14.7; architechture.md §8.4, §9.3, §11.1

```text
Create a pure, fully unit-tested pricing engine (module: orders, file pricing/). No DB access in
the core functions; a thin loader gathers inputs from the DB.

Functions:
1. priceCart(input) → PricedCart where input = {lines:[{skuId, qty, unitPricePaisa, vatRateBp,
   tier, categoryId, fulfillmentType, weightGrams}], coupon?: CouponRule, deliveryZone?:
   'INSIDE_DHAKA'|'OUTSIDE_DHAKA', channel: 'COURIER'|'PICKUP'|'WALK_IN', storeCreditPaisa?,
   customerRisk?}
   Steps:
   a. Mixed-cart check: all lines same fulfillmentType, else throw ERR_MIXED_CART_DISALLOWED (422)
      with details.rejected_skus.
   b. Line gross = unitPrice × qty (prices are VAT-inclusive).
   c. Coupon: validate scope (tier/category/SKU), min order value, max discount; compute the discount
      (fixed or percent in bp, rounded down to paisa); allocate pro-rata across ELIGIBLE lines with
      largestRemainderAllocate. Coupons never apply to delivery fees or advance fees.
   d. Per-line net = gross − allocated discount; VAT split per line with vatFromInclusive.
   e. Delivery fee (COURIER only, one per shipment): base by zone (settings: ৳80 / ৳150 for up to
      1 kg) + ceil((totalWeight − 1000g)/1000) × per-kg surcharge. PICKUP/WALK_IN → 0.
   f. Store credit applied (capped at the product amount; NEVER applied to the advance fee).
   g. Totals: subtotal, discount, delivery fee, vat_total (informational, already inside prices),
      total_payable, store_credit_applied, amount_due.
2. unitDepositPaisa / orderDepositPaisa — EXACT code from architechture.md §8.4. The effective unit
   price = floor(line net after allocated discount / qty). Unit tests MUST cover the PRD table:
   ৳30,000→৳6,000; ৳50,000→৳10,000; ৳80,000→৳13,000; ৳150,000→৳20,000; ৳300,000→৳35,000,
   plus rounding up to ৳10 and the "never more than the unit price" cap.
3. paymentPlan({orderType, channel, paymentMode, codEligibility, totals, deposit,
   preorderCodBalanceMax}) → {advanceRequiredPaisa, advancePurpose ('FULL'|'ADVANCE_FEE'|
   'DEPOSIT'|null), codCollectiblePaisa, allowedModes[]} implementing:
   - REGULAR + COD: FULL_COD → advance 0, COD = amount due; ADVANCE_FEE_REQUIRED → advance =
     BASE zone fee only (৳80/৳150, paid online), COD = rest (product + weight surcharge − store
     credit); COD_BLOCKED → COD not allowed (ERR_COD_NOT_ALLOWED, 422; PRD wins over api-spec's
     wording).
   - REGULAR + ONLINE_FULL: advance = amount due.
   - PICKUP + PAY_AT_COUNTER: allowed only if every line is allocated from SHOWROOM_COUNTER
     physical stock OR the customer is FULL_COD eligible; otherwise ONLINE_FULL only.
   - PRE_ORDER: advance = deposit (online); balance = total − deposit − store credit; balance COD
     allowed only if balance ≤ PREORDER_COD_BALANCE_MAX (৳30,000) and not COD-blocked.
4. marginCheck({listPricePaisa, vatRateBp, quotedUnitCostPaisa, baseCostPaisa, spotBufferBp,
   minMarginBp}) → {allowed, marginBp, overBuffer} per architechture.md §11.1 (margin is computed
   on the list price EXCLUDING VAT; coupons and delivery are excluded).
5. refundableAmountForLines(order, lineIds) — amount actually paid for the lines after allocated
   discount; the advance fee is refundable unless the parcel was handed to the courier (PRD §3.14.5).

Write table-driven tests for every rule above, including property-based tests (fast-check) that
allocations always sum exactly and no amount is negative.
```

---

## P16 — Coupons & Store Credit

**Depends on:** P15 · **Docs:** PRD §3.14.6, §3.14.7; api-spec §17 (coupons)

```text
Implement promotions (module: promotions).

Coupons:
1. coupons(id, code unique uppercase, type ('FIXED'|'PERCENT'), value (paisa or bp), min_order_paisa,
   max_discount_paisa null, scope_type ('ALL'|'TIER'|'CATEGORY'|'SKU'), scope_values text[],
   starts_at, ends_at, usage_limit null, per_phone_limit default 1, status ('DRAFT'|'ACTIVE'|
   'PAUSED'|'EXPIRED'), created_by, activated_by, created_at).
2. coupon_redemptions(id, coupon_id, order_id unique, customer_id, phone, discount_paisa,
   status ('RESERVED'|'CONFIRMED'|'RELEASED'), created_at).
   Usage counts only CONFIRMED + RESERVED; release on order cancel or payment expiry.
3. Endpoints: POST/PUT /api/v1/admin/coupons (CATALOG_MANAGER drafts), POST
   /api/v1/admin/coupons/:id/activate|pause (SUPER_ADMIN, four-eyes: not the creator),
   GET list. Public validation happens inside cart/validate (P19).
4. Concurrency: redeem with a row lock on the coupon to enforce usage_limit and per_phone_limit.

Store credit:
5. store_credit_entries(id, customer_id, delta_paisa (+/-), reason ('GOODWILL'|'PREORDER_DELAY'|
   'RMA_RESOLUTION'|'REFUND_AS_CREDIT'|'APPLIED_TO_ORDER'|'REVERSAL'|'EXPIRY'|'WITHDRAWAL'),
   withdrawable bool, expires_at null, source_entry_id null (for consumption tracking),
   ref_type, ref_id, created_by, created_at). Append-only.
6. Balance = sum(delta) of non-expired lots. Consume FIFO by earliest expiry; non-withdrawable
   (goodwill) credit is consumed first. Goodwill expires after GOODWILL_CREDIT_EXPIRY_MONTHS (12);
   refund-as-credit never expires and is withdrawable.
7. Service: issue(tx, {customerId, amount, reason, withdrawable, expiresAt, actor}) with permission
   store_credit.issue (Support ≤ ৳1,000, Finance ≤ ৳20,000, Admin above) → ledger posting hook
   TODO(P17) (goodwill: Dr 5400 / Cr 2020); apply(tx, {customerId, orderId, amount});
   reverse(tx, ...); withdraw(tx, ...) (FINANCE_OFFICER; only withdrawable lots; ledger 2020 → 1040/1030).
8. Daily expiry job 00:15 → EXPIRY entries for expired lots (ledger: Dr 2020 / Cr 5400 reversal
   of goodwill — record the decision in DECISIONS.md).
9. Endpoints: GET /api/v1/customer/store-credit (balance + history),
   POST /api/v1/admin/customers/:id/store-credit (issue), POST .../withdraw.

Tests: per-phone limit under concurrency, FIFO consumption order, expiry, approval limits.
```

---

## P17 — Double-Entry Ledger (In-House)

**Depends on:** P16 · **Docs:** PRD §3.13; architechture.md §10.1–10.3 (chart of accounts + posting rules)

```text
Implement the general ledger (module: ledger). Accuracy is critical.

1. Tables: ledger_accounts(id, code unique, name, type ('ASSET'|'LIABILITY'|'EQUITY'|'INCOME'|
   'EXPENSE'), normal_side, is_contra, requires_sub_ledger bool); journal_entries(id, entry_number
   unique (JRN-YYYYMMDD-NNNNN), event_type, source_type, source_id, description, posted_at,
   posted_by_type, posted_by_id, reversal_of null) UNIQUE(event_type, source_type, source_id);
   journal_lines(id, entry_id, account_id, sub_ledger_type null ('ORDER'|'CUSTOMER'|'COURIER'|
   'SUPPLIER'|'RUNNER'|'DRAWER'), sub_ledger_ref null, debit_paisa, credit_paisa) with the
   one-side CHECK. Both append-only. Add the DEFERRABLE balanced-entry constraint trigger EXACTLY
   as architechture.md §10.1.
2. Seed the full chart of accounts from architechture.md §10.2 (codes 1000–5400).
3. ledger.post(tx, {eventType, sourceType, sourceId, lines, description, actor}) — validates
   balance in app code too, idempotent (unique key → returns the existing entry), never called
   outside a business transaction. ledger.reverse(tx, entryId, reason) creates the mirror entry.
4. Posting rules registry (src/modules/ledger/rules.ts): one typed builder per business event from
   architechture.md §10.3. Name them, e.g.:
   ONLINE_PAYMENT_VALIDATED, PREORDER_DEPOSIT_VALIDATED, STORE_CREDIT_APPLIED,
   REVENUE_RECOGNIZED_DELIVERY (handles prepaid 2000/2010 + COD 1110 or counter 1010/1040/1030 +
   4010 discount → 4000 net ex-VAT + discount, 2100 VAT, 4020 delivery fee), COGS_RECOGNIZED,
   POS_WALKIN_SALE, RUNNER_CASH_PURCHASE, SUPPLIER_CREDIT_PURCHASE, SUPPLIER_PAID, FLOAT_ISSUED,
   FLOAT_RETURNED, CASH_SHORTAGE, CASH_OVERAGE (decide the account: credit 5310 → record in
   DECISIONS.md), COURIER_PAYOUT_MATCHED, GATEWAY_SETTLEMENT_MATCHED, REFUND_BEFORE_DELIVERY,
   REFUND_AFTER_DELIVERY (4040 + 2100 reversal; returned unit Dr 1200 / Cr 5000 at cost),
   PREORDER_DEPOSIT_FORFEITED, RTO_ADVANCE_FEE_RETAINED, GOODWILL_CREDIT_ISSUED,
   STORE_CREDIT_WITHDRAWN, STOCK_WRITE_OFF, SUPPLIER_CASH_REFUND, STORE_CREDIT_EXPIRED.
   Each builder takes typed amounts and returns balanced lines with sub-ledger refs.
5. Wire the TODO hooks from P14 (write-off) and P16 (goodwill, withdrawal, expiry).
6. Queries: accountBalance(code, asOf, subLedgerRef?), trialBalance(asOf), subLedgerBalance
   (e.g. customer deposits per order, store credit per customer, courier receivable per courier).
   GET /api/v1/finance/ledger/trial-balance (FINANCE_OFFICER, SUPER_ADMIN) — api-spec §14.4 shape
   (ensure is_balanced=true). GET /api/v1/finance/ledger/entries (filters), GET
   /api/v1/finance/ledger/accounts/:code/statement.

Tests:
- The DB rejects an unbalanced entry (integration) and an UPDATE on journal_lines.
- Posting the same business event twice → one entry.
- Property-based test: every rule builder with random amounts → debits == credits, all lines
  one-sided, no negatives.
- A golden-scenario test: COD order with coupon + advance fee → payment → delivery → courier payout;
  the final trial balance matches hand-computed expected balances.
```

---

# STAGE 5 — ORDERS, CHECKOUT & PAYMENTS

## P18 — Order Schema & State Machines

**Depends on:** P17 · **Docs:** PRD §3.12, §7 (Order, OrderItem, OrderStatusHistory, PreOrder, PaymentTransaction); architechture.md §8.3

```text
Create order tables and the state machine engine (module: orders).

Tables:
1. orders(id, order_number unique, customer_id, channel ('STOREFRONT_WEB'|'SHOWROOM_POS'|
   'PHONE_ORDER'), order_type, fulfillment_channel ('COURIER'|'PICKUP'|'WALK_IN'), delivery_zone
   null, status, payment_status, payment_mode ('ONLINE_FULL'|'COD'|'PAY_AT_COUNTER'|
   'PREORDER_DEPOSIT'), address_snapshot jsonb null (consignee, phone, division/district/thana/area
   ids + names, address_line, is_inside_dhaka), subtotal_paisa, discount_paisa,
   delivery_fee_paisa, vat_total_paisa, total_payable_paisa, store_credit_applied_paisa,
   advance_required_paisa, advance_paid_paisa, advance_purpose, cod_amount_paisa, paid_total_paisa,
   refunded_total_paisa, coupon_id null, mushak_requested bool, buyer_company_name null, buyer_bin
   null, pickup_pin_hash null, pickup_pin_expires_at null, pickup_pin_attempts int default 0,
   pickup_pin_locked bool, placed_at, confirmed_at, cancelled_at, cancel_reason, created_at,
   updated_at). Indexes: (customer_id, created_at desc), (status, order_type), (payment_status).
2. order_items(id, order_id, sku_id, product_id, title_en, title_bn, tier, sku_code, qty,
   unit_price_paisa, allocated_discount_paisa, line_total_paisa, vat_rate_bp, vat_paisa,
   unit_cost_paisa null (set at purchase/commit), source ('PHYSICAL'|'VIRTUAL'),
   source_location_id null, status ('ACTIVE'|'CANCELLED'|'DELIVERED'|'RETURNED'|'RTO'),
   created_at).
3. order_item_units(id, order_item_id, unit_index, seal_id null, manufacturer_serial null,
   status) — one row per physical unit (qty 3 → 3 rows) so each unit gets its own seal (P26).
4. order_status_history (append-only: order_id, from_status, to_status, actor_type, actor_id,
   reason, metadata jsonb, created_at).
5. pre_orders(order_id pk, deposit_paisa, balance_paisa, eta_date, eta_min_days, eta_max_days,
   price_locked_paisa, milestone, arrived_at, qc_verified_at, balance_due_date, forfeiture_date,
   repricing_status ('NONE'|'PENDING'|'ACCEPTED'|'REJECTED'), repricing_new_total_paisa,
   repricing_deadline, delay_option ('NONE'|'OFFERED'|'CANCELLED'|'KEPT_WITH_CREDIT'),
   delay_offered_at, batch_key null).
6. payment_transactions(id, tran_id unique (NCA-TXN-YYYYMMDD-XXXXXX), order_id, customer_id,
   purpose ('FULL'|'ADVANCE_FEE'|'DEPOSIT'|'BALANCE'), method ('SSLCOMMERZ'|'CASH_COUNTER'|
   'BKASH_QR'|'NAGAD_QR'|'CARD_TERMINAL'|'COURIER_COD'|'STORE_CREDIT'), amount_paisa, currency
   'BDT', status ('INITIATED'|'PENDING'|'PAID'|'FAILED'|'CANCELLED'|'HOLD_REVIEW'|'EXPIRED'),
   gateway_session_key, val_id, bank_tran_id, card_type, risk_level, risk_title,
   validated_at, raw_ipn jsonb, raw_validation jsonb, external_ref (counter ref numbers),
   created_at, updated_at).

State machine (src/modules/orders/state-machine.ts):
- TRANSITIONS as data for REGULAR_DROP_PACK and PRE_ORDER, exactly following PRD §3.12:
  REGULAR: PENDING_PAYMENT→CONFIRMED|CANCELLED; CONFIRMED→SOURCING|AT_GODOWN_QC|CANCELLED;
  SOURCING→AT_GODOWN_QC|CANCELLED; AT_GODOWN_QC→PACKED|CANCELLED; PACKED→HANDED_TO_COURIER|
  READY_FOR_PICKUP; HANDED_TO_COURIER→DELIVERED|PARTIALLY_DELIVERED|RTO_IN_TRANSIT;
  PARTIALLY_DELIVERED→RTO_IN_TRANSIT (for returned lines; record the decision);
  RTO_IN_TRANSIT→RTO_RECEIVED; READY_FOR_PICKUP→DELIVERED_COUNTER|PICKUP_EXPIRED.
  WALK_IN orders are created directly as DELIVERED_COUNTER (document the special path).
  PRE_ORDER: DEPOSIT_PENDING→DEPOSIT_PAID|CANCELLED; DEPOSIT_PAID→SOURCED_IN_TRANSIT|
  CANCELLED_REFUNDED|REPRICING_PENDING; SOURCED_IN_TRANSIT→ARRIVED_GODOWN|REPRICING_PENDING|
  CANCELLED_REFUNDED (import failure / delay cancel only); REPRICING_PENDING→previous state
  (store it in metadata)|CANCELLED_REFUNDED; ARRIVED_GODOWN→QC_VERIFIED_BALANCE_DUE;
  QC_VERIFIED_BALANCE_DUE→BALANCE_PAID|BALANCE_COD_SCHEDULED|DEPOSIT_FORFEITED_CANCELLED;
  BALANCE_PAID|BALANCE_COD_SCHEDULED→PACKED; then the same delivery/pickup path as REGULAR.
- transitionOrder(tx, orderId, to, actor, reason?, metadata?) — EXACT pattern from
  architechture.md §8.3 (SELECT ... FOR UPDATE, check, update, history row, outbox
  'order.status_changed'). Optional guard functions per transition (e.g. CANCELLED from SOURCING
  only by staff after purchase).
- Payment status machine (UNPAID, PENDING, PARTIALLY_PAID, PAID, REFUND_PENDING,
  PARTIALLY_REFUNDED, REFUNDED, FAILED) derived by recomputePaymentStatus(tx, orderId) from
  payment_transactions and refunds; never set by hand.

Tests: every allowed transition passes, a sample of illegal ones fail with ERR_ILLEGAL_TRANSITION;
concurrent transitions on the same order are serialized; history rows are append-only.
```

---

## P19 — Cart Validation & Stock Reservation Endpoints

**Depends on:** P18 · **Docs:** PRD §3.3.1, §3.6.3; api-spec §5.1, §5.2

```text
Implement stateless cart endpoints (module: orders).

1. POST /api/v1/cart/validate {items:[{sku_id, quantity}], coupon_code?, delivery_zone?,
   fulfillment_channel?} — public/guest/customer.
   - Load authoritative SKUs (published + active only); unknown/unavailable SKUs are reported per
     line (not a hard failure) with reason codes (NOT_FOUND, UNPUBLISHED, OUT_OF_STOCK,
     QTY_EXCEEDS_CAP).
   - Mixed cart → 422 ERR_MIXED_CART_DISALLOWED with the PRD modal message in en + bn and
     details.rejected_skus.
   - Price with priceCart (P15): the api-spec §5.1 response shape plus order_type, per-line
     availability/allocation preview, coupon result {applied, code, discount_paisa, reason_if_not},
     delivery fee for both zones (or the selected zone), and for PRE_ORDER: deposit_paisa,
     balance_paisa, balance_cod_allowed, ETA range.
   - If the caller is a logged-in customer: include cod_eligibility and allowed payment modes.
2. POST /api/v1/cart/reserve {items, fulfillment_channel} — optional pre-checkout hold for
   physical stock lines (api-spec §5.2). Create a "cart hold" record (cart_holds table: id,
   device_id, customer_id null, expires_at, status) and reservations linked to it (allow
   stock_reservations.order_id to be null when cart_hold_id is set; CHECK exactly one is set).
   Returns reservation_id (= cart hold id), expires_at, duration_seconds 600. 409
   ERR_INSUFFICIENT_STOCK with available qty per line. Rate limit 30/min per device.
   Checkout (P20) converts a cart hold's reservations to the order (same expiry) or reserves anew.
3. Expiry job (P14) also releases cart-hold reservations.

Tests: mixed cart 422; price tampering impossible (client prices ignored); coupon invalid reasons;
reservation → checkout conversion keeps the units; expired hold releases stock.
```

---

## P20 — Checkout (Regular Orders: COD Tiers, Advance Fee, Online, Pickup)

**Depends on:** P19 · **Docs:** PRD §3.5 (guest), §3.6, §3.7, §3.11.3, Flow 3; architechture.md §9.1, §9.3; api-spec §6.1

```text
Implement POST /api/v1/orders/checkout for REGULAR_DROP_PACK orders (PRE_ORDER is handled in P23,
but the endpoint is shared — route by order type). Requires a customer session (an OTP-verified
guest is a customer whose session was created by OTP verify). Idempotency-Key required.
Rate limit: 10 checkouts/hour per customer (flag for review beyond that, PRD/arch §7.4).

Request (api-spec §6.1 adapted): {order_type, reservation_ids?, items, fulfillment_channel
('COURIER'|'PICKUP'), delivery_zone (derived from the address when an address is given — never
trusted from the client), address_id OR shipping_address{consignee_name, phone, division_id,
district_id, thana_id, area_id?, address_line}, payment_mode ('ONLINE_FULL'|'COD'|
'PAY_AT_COUNTER'), coupon_code?, store_credit_paisa?, mushak_requested?, buyer_company_name?,
buyer_bin?}.

One DB transaction:
1. Re-validate everything server-side (P19 logic). Mixed cart → 422.
2. Allocate lines (P14 allocate): convert cart-hold reservations or reserve physical stock for
   PHYSICAL lines; VIRTUAL lines need no reservation; any line not purchasable → 409 with details.
3. Compute pricing + paymentPlan (P15) with the customer's codEligibility. COD_BLOCKED + COD →
   422 ERR_COD_NOT_ALLOWED. PAY_AT_COUNTER rules enforced.
4. Create the order (order_number via counter), items, units, address snapshot, coupon redemption
   (RESERVED), store credit application (ledger STORE_CREDIT_APPLIED), status history.
5. Branches:
   a. FULL_COD, nothing to pay online → status CONFIRMED immediately, commit reservations, emit
      'order.confirmed'. Response 201 {order_number, status:'CONFIRMED', payment_status:'UNPAID',
      cod_amount_collectible_paisa, estimated_delivery}.
   b. Online payment needed (ONLINE_FULL, ADVANCE_FEE, or amount due > 0 for pickup prepay) →
      status PENDING_PAYMENT, create payment_transactions row (INITIATED, purpose FULL or
      ADVANCE_FEE, amount = advance). Store credit can never pay the advance fee.
   c. Amount due fully covered by store credit → CONFIRMED with payment_status PAID.
   d. PICKUP + PAY_AT_COUNTER → CONFIRMED (payment at handover).
6. Emit outbox: 'order.placed' (Class A notification), analytics 'order_placed'.
After commit (outside the tx): for branch b call SSLCommerz session init (P21 service) and return
201 {order_number, status:'PENDING_PAYMENT', payment_redirect_url, payable_paisa, tran_id}.
If the session init fails, return 502 ERR_GATEWAY_UNAVAILABLE with a retry endpoint
POST /api/v1/orders/:orderNumber/pay (re-initiates for the open transaction; idempotent).

After confirmation (shared function confirmOrder(tx, orderId) reused by P21):
- Commit physical reservations (commit() false → try re-reserve → else switch the line to VIRTUAL if
  a supplier is available → else mark the line for refund and emit 'order.line_unfulfillable').
- Coupon redemption → CONFIRMED.
- If any VIRTUAL lines → transition to SOURCING and emit 'sourcing.tasks_needed' (P24); else
  AT_GODOWN_QC (P26 picks it up).
- Generate the system invoice record (P22) — TODO hook.
- PICKUP orders: generate the pickup PIN later when READY_FOR_PICKUP (P30).

Tests (integration): FULL_COD path; first-time buyer → advance fee transaction of exactly ৳80
inside Dhaka / ৳150 outside; COD blocked → 422; store credit cannot cover the advance fee;
idempotent replay returns the same order; parallel checkouts for the last unit → one wins;
virtual-line orders go to SOURCING.
```

---

## P21 — SSLCommerz Payments (Session, IPN, Validation, Reconciliation)

**Depends on:** P20 · **Docs:** PRD §3.6.1, §3.6.3; architechture.md §9.1; api-spec §7

```text
Implement payments (module: payments) with an SslcommerzClient interface + real implementation
(sandbox/live via env) + mock implementation (simulates success/fail/IPN in dev and tests).

1. initSession(paymentTx) → POST to the SSLCommerz session API with total_amount (paisa → taka
   string with 2 decimals), currency BDT, tran_id, success/fail/cancel/ipn URLs, customer info
   (minimal), product_profile 'general'. Store gateway_session_key and set status PENDING.
2. POST /api/v1/payments/sslcommerz/ipn (form-urlencoded, public):
   - Verify verify_sign: MD5 over the sorted verify_key fields + md5(store_passwd) per SSLCommerz
     docs → 400 INVALID_SIGNATURE_HASH on mismatch (log + audit-system row).
   - Call the Order Validation API with val_id; check status VALID/VALIDATED, tran_id, amount,
     currency equal to our record. Mismatch → mark FAILED + Class A internal alert.
   - risk_level = 1 → status HOLD_REVIEW and a Support queue item; do NOT confirm the order.
   - Else applyPaymentSuccess(tranId, validation) in ONE transaction, idempotent on tran_id
     (SELECT ... FOR UPDATE; if already PAID → no-op): mark PAID; ledger
     ONLINE_PAYMENT_VALIDATED (Dr 1100 / Cr 2000) or PREORDER_DEPOSIT_VALIDATED (Cr 2010);
     update advance_paid/paid_total; recomputePaymentStatus; transition the order according to
     purpose (FULL/ADVANCE_FEE → confirmOrder; DEPOSIT → DEPOSIT_PAID; BALANCE → BALANCE_PAID);
     outbox 'payment.succeeded' (Class A notification 3, analytics).
   - Always respond 200 to valid-signature IPNs (even duplicates).
3. POST /api/v1/payments/sslcommerz/success — cross-site browser POST; run the same validation
   (idempotent) then 303 to /{locale}/account/orders/{orderNumber}?status=paid. Never rely on the
   session cookie here.
4. POST /api/v1/payments/sslcommerz/fail and /cancel → mark FAILED/CANCELLED (unless already PAID),
   release nothing yet (the reservation expires naturally), 303 to the order page with the status.
   Customers may retry via POST /api/v1/orders/:orderNumber/pay (new tran_id, old one CANCELLED).
5. Late payment (PRD §3.6.3): if a payment becomes PAID after the reservation expired,
   confirmOrder's commit fallback applies (re-reserve → virtual → auto-refund request with reason
   STOCKOUT_AFTER_LATE_PAYMENT, executed in P33).
6. Jobs:
   - Reconciliation every 5 min: PENDING transactions older than 10 min and newer than 24h → query
     the Transaction Query API by tran_id → VALID/VALIDATED → applyPaymentSuccess; FAILED →
     mark FAILED.
   - Unpaid auto-cancel every 15 min: PENDING_PAYMENT / DEPOSIT_PENDING orders older than
     UNPAID_ORDER_CANCEL_HOURS (24h) → CANCELLED, release reservations, release coupon, reverse
     store credit application (ledger reversal), transactions → EXPIRED.
7. Admin: GET /api/v1/admin/payments (filters), POST /api/v1/admin/payments/:tranId/review
   {decision: 'APPROVE'|'REJECT'} for HOLD_REVIEW (CUSTOMER_SUPPORT or SUPER_ADMIN; reject → refund
   request in P33).
8. Optional IP allow-list for the IPN (env list; disabled in dev).

Tests: valid IPN confirms the order once even when IPN + success + reconciliation run concurrently
(3 parallel calls); a tampered amount is rejected; risk hold path; auto-cancel releases everything;
signature verification unit tests with known vectors.
```

---

## P22 — Customer Orders, Cancellation, Invoices & Mushak 6.3

**Depends on:** P21 · **Docs:** PRD §3.4.6, §3.6.4, §3.12; architechture.md §15.4; api-spec §6.2, §6.3, §14.5

```text
Implement customer order endpoints and invoicing (modules: orders, finance).

1. GET /api/v1/orders (own orders, paginated, filters status/type) and GET /api/v1/orders/:orderNumber
   → full detail: items with tier badges, totals, payment summary, timeline (from status history,
   customer-safe labels in bn/en), courier tracking url (P29), pre-order milestones (P23),
   assigned seal IDs (P26), invoice links, cancellation eligibility {can_cancel, reason}.
2. POST /api/v1/orders/:orderNumber/cancel {reason} (customer):
   - REGULAR: allowed in PENDING_PAYMENT, CONFIRMED, and SOURCING only while NO runner purchase has
     been recorded for any line (query sourcing via its service). Otherwise 403
     ERR_CANCELLATION_DISALLOWED ("contact support").
   - PRE_ORDER: allowed in DEPOSIT_PENDING, DEPOSIT_PAID; from SOURCED_IN_TRANSIT onward → 403 with
     the api-spec message (deposit non-refundable). Delay-window cancellation is handled in P23.
   - Effects in one tx: transition → CANCELLED, release reservations/coupon, reverse store credit
     application, create refund requests for all paid amounts (P33 hook: emit
     'refund.requested' with reason CUSTOMER_CANCELLATION; auto-approved for system reasons),
     outbox notifications.
   - Staff cancellation endpoint POST /api/v1/admin/orders/:id/cancel (CUSTOMER_SUPPORT) covers
     after-purchase / before-handover cancellations: purchased items are received into
     GODOWN_NAWABPUR physical stock (CANCELLATION_RECEIPT movement); full refund.
3. Invoices: invoices(id, order_id unique, invoice_no (INV-YYYY-NNNNN), type ('SYSTEM'|'MUSHAK_6_3'),
   mushak_serial null, fiscal_year, buyer_name, buyer_bin, seller_bin (settings), lines jsonb
   snapshot, subtotal/vat/total paisa, pdf_media_id, issued_at). Create the SYSTEM invoice on
   confirmation (wire the P20 hook). If mushak_requested → also a MUSHAK_6_3 invoice with a gapless
   serial from number_counters(scope 'MUSHAK_6_3', period fiscalYearOf(issued_at)) in the SAME
   tx as issuance. Issue Mushak invoices at revenue recognition (delivery/handover) — record the
   decision; a VAT consultant must confirm (TODO-CONFIRM).
4. PDF generation job (queue: media): render invoice PDFs with pdfkit or @react-pdf/renderer
   (Bangla font: Hind Siliguri embedded), upload to the private bucket, link the media asset.
5. GET /api/v1/orders/:orderNumber/invoices and GET /api/v1/finance/invoices/:orderId/mushak-6-3
   (owner or FINANCE_OFFICER) → signed URL (5 min).
6. Staff order views: GET /api/v1/admin/orders (filters by status/type/channel/date/phone),
   GET /api/v1/admin/orders/:id (PII via the role serializer), POST /api/v1/admin/orders/:id/notes.

Tests: cancellation rules per state; gapless Mushak serials under concurrency and across the
fiscal year boundary (30 June 23:59 Dhaka vs 1 July 00:00); customers can only see their own orders.
```

---

# STAGE 6 — PRE-ORDER ENGINE

## P23 — Pre-Order Engine (Deposit, Milestones, Balance, Delay, Repricing, Forfeiture, Batch)

**Depends on:** P22 · **Docs:** PRD §3.3 (all), §3.12.2, §3.14 (delay credit), Flow 2, Flow 8; architechture.md §8.4

```text
Implement the full pre-order lifecycle (module: preorder; it uses the orders/payments/ledger
services).

1. Checkout for order_type PRE_ORDER (shared endpoint from P20):
   - Cart must be PRE_ORDER-only (422 otherwise). Products must be PUBLISHED with BTRC cleared where
     required.
   - Deposit = orderDepositPaisa(lines after allocated coupon discount). Store credit may pay the
     deposit (and later the balance). Create order DEPOSIT_PENDING + pre_orders row (price_locked,
     ETA from product eta range, batch_key = sku + month if the product has a batch threshold) +
     payment transaction purpose DEPOSIT → SSLCommerz. On IPN → DEPOSIT_PAID, ledger
     PREORDER_DEPOSIT_VALIDATED (Cr 2010 per order), notification 2/3.
2. Staff milestone endpoints (/api/v1/admin/preorders, SOURCING_MANAGER; GODOWN_MANAGER for
   arrival/QC):
   - GET list with filters (status, sku, eta overdue, batch).
   - POST /:orderId/sourced {supplier_ref, eta_date} → SOURCED_IN_TRANSIT (customer cancellation
     is disabled from now on). Notification 5 (Class B).
   - POST /:orderId/arrived → ARRIVED_GODOWN + receive units into QC_HOLD (P14).
   - QC pass (from the P26 QC flow with qc_type FULL_PRE_DISPATCH) → QC_VERIFIED_BALANCE_DUE, set
     qc_verified_at, balance_due_date = +7 days, forfeiture_date = Day 8. Notification 6.
   - POST /:orderId/import-failed {reason, offer_switch_sku_ids?} → customer is offered a full
     refund (within 7 working days) or a SKU switch: CANCELLED_REFUNDED + refund request (P33), or
     a switch endpoint for the customer.
3. Customer balance payment: POST /api/v1/orders/:orderNumber/balance {mode: 'ONLINE'|'COD'|
   'COUNTER'}:
   - ONLINE → payment transaction purpose BALANCE → BALANCE_PAID on IPN.
   - COD → only if balance ≤ PREORDER_COD_BALANCE_MAX and not COD-blocked → BALANCE_COD_SCHEDULED
     with cod_amount = balance.
   - COUNTER (showroom pickup) → allowed; paid at handover (P30).
4. Delay handling: daily job 09:00 finds pre-orders not ARRIVED by eta_date + 7 days → set
   delay_option OFFERED, notify the customer with two choices valid for 24h:
   POST /api/v1/orders/:orderNumber/preorder/delay-choice {choice: 'CANCEL'|'KEEP'}.
   CANCEL (within 24h) → CANCELLED_REFUNDED + 100% refund (even though it's in transit).
   KEEP or no answer → keep; on arrival automatically issue a ৳1,000 goodwill store credit
   (PREORDER_DELAY reason, ledger GOODWILL_CREDIT_ISSUED). Record the "no answer = keep" decision.
5. FX repricing (PRD §3.3.5): POST /api/v1/admin/preorders/:orderId/repricing {new_unit_price_paisa,
   fx_change_bp, reason} (SOURCING_MANAGER; only if fx_change_bp > 800) → REPRICING_PENDING with a
   48h deadline. Customer: POST /api/v1/orders/:orderNumber/preorder/repricing {accept: bool}:
   accept → the balance changes (deposit unchanged), back to the previous state; reject or
   timeout (job) → CANCELLED_REFUNDED with a 100% refund.
6. Balance reminders: daily 10:00 job sends Class B reminders on Day 1, 4 and 7 after QC
   (notification 8). Day 7 also creates a Support call task (support_tasks table: id, type,
   order_id, due_at, status, assigned_to).
7. Forfeiture: daily 00:05 job: QC_VERIFIED_BALANCE_DUE with forfeiture_date ≤ today (Day 8) →
   DEPOSIT_FORFEITED_CANCELLED; ledger PREORDER_DEPOSIT_FORFEITED (Dr 2010 / Cr 4030); move the units
   from QC_HOLD to GODOWN_NAWABPUR (PREORDER_FORFEIT_RECEIPT); mark the SKU unit as a "Flash Deal"
   (flash_deals table: id, sku_id, qty, price_paisa = landed price, starts_at, ends_at, status)
   so it sells as REGULAR physical stock (catalog shows the flash deal price; pricing engine
   respects the active flash deal price for physical units).
8. Batch threshold: daily 01:00 job: for products with preorder_batch_threshold N, batches older
   than 30 days with fewer than N paid deposits → notify customers with options: full refund, or
   pay an individual expedited import fee (create a payment request) — implement the refund path;
   leave the expedited fee path as an admin-handled option with a TODO.
9. Customer view: pre-order milestone visualizer data in order detail (milestones with timestamps).

Tests: deposit table values end-to-end; cancellation blocked after SOURCED_IN_TRANSIT; delay cancel
within 24h refunds 100%; repricing accept changes only the balance; Day-8 forfeiture posts the ledger
entry and creates physical stock; balance COD cap (৳30,000 allowed, ৳30,000.01 rejected).
```

---

# STAGE 7 — SOURCING & RUNNER

## P24 — Runner Tasks & Spot-Price Tolerance

**Depends on:** P23 · **Docs:** PRD §3.4.1–3.4.4, Flow 5, §3.9 (runner PII masking); architechture.md §11.1; api-spec §10.1, §10.3

```text
Implement runner sourcing tasks (module: sourcing).

1. runner_tasks(id, task_number unique, task_type ('SOURCING'|'SUPPLIER_RETURN'|'WARRANTY_LIAISON'),
   order_id null, order_item_id null, sku_id, qty, supplier_id, backup_supplier_id null,
   max_unit_price_paisa, runner_id null, status ('PENDING_ASSIGNMENT'|'DISPATCHED'|
   'STALL_CONTACTED'|'PRICE_EXCEEDED_PENDING'|'PURCHASED'|'RECEIVED_AT_GODOWN'|'REROUTED'|
   'CANCELLED'|'DECLINED'), quoted_unit_price_paisa null, override_reason, override_decided_by,
   override_decision ('APPROVED'|'REROUTED'|'DECLINED'), due_at (created + 2h), created_at,
   updated_at) + runner_task_events (append-only history).
2. On 'sourcing.tasks_needed' (VIRTUAL lines of a confirmed order): create one SOURCING task per
   line with the primary supplier + backup (P13), max_unit_price = base_cost × (1 + spot_buffer).
   Auto-assign to the runner with the fewest open tasks who is on shift (open float session, P25);
   otherwise PENDING_ASSIGNMENT plus an SSE alert to Sourcing Managers.
3. Runner endpoints (FIELD_RUNNER, own tasks only, PII-free DTO per api-spec §10.1 — order number,
   SKU, title, qty, stall, max price; NO customer data):
   GET /api/v1/runner/tasks; POST /api/v1/runner/tasks/:taskId/contacted;
   POST /api/v1/runner/tasks/:taskId/request-override {quoted_cost_paisa, reason} → run marginCheck
   (P15). If allowed (within buffer AND margin ≥ 15%) → return {allowed:true} (no approval needed).
   Else → PRICE_EXCEEDED_PENDING, outbox 'sourcing.override_requested' → SSE to SOURCING_MANAGER
   (P37) + a delayed job at +5 min that re-sends via WhatsApp/SMS if not acknowledged (P36).
4. Manager endpoints (SOURCING_MANAGER): GET /api/v1/admin/sourcing/tasks (filters),
   POST /:taskId/assign {runner_id}, POST /:taskId/acknowledge,
   POST /:taskId/override-decision {decision: 'APPROVE'|'REROUTE'|'DECLINE', backup_supplier_id?}:
   APPROVE → the runner may buy at the quoted price (record margin); REROUTE → status REROUTED, a new
   task for the backup stall; DECLINE → cancel the task and mark the order line unfulfillable →
   customer options flow (refund / alternate tier / backorder; notify within 4h, PRD §3.4.4) and a
   refund request (P33).
5. Stockout handling: if no supplier is available for a line when tasks are created → emit
   'order.line_unfulfillable' → support task + customer notification with the three options;
   POST /api/v1/orders/:orderNumber/lines/:lineId/stockout-choice {choice:'REFUND'|'ALTERNATE'|
   'BACKORDER', alternate_sku_id?}.
6. When all SOURCING lines of an order are PURCHASED and received at the godown (P25 receive step) →
   transition the order SOURCING → AT_GODOWN_QC.
7. Partial stockout (EC-05): if some lines are unfulfillable and the customer keeps the rest, the
   order continues with the remaining lines; the delivery fee is charged once only (no
   re-charge on split).

Tests: auto-assignment; the margin rule (buffer 5% and 15% margin, VAT excluded); escalation job
fires at 5 min only when unacknowledged; runner DTO has no PII; reroute creates a backup task.
```

---

## P25 — Runner Float Sessions, Purchases & Offline Sync

**Depends on:** P24 · **Docs:** PRD §3.4.3, §3.4.5, §3.13.4, §3.18.4, Flow 12; architechture.md §10.6, §11.2; api-spec §10.2, §14.1

```text
Implement runner cash and the offline-safe sync API (modules: sourcing, finance, ledger).

1. runner_float_sessions(id, runner_id, issued_paisa, purchases_cash_paisa, supplier_refunds_paisa,
   returned_paisa null, variance_paisa null, status ('OPEN'|'PENDING_COUNT'|'VARIANCE_REVIEW'|
   'CLOSED'), opened_by, opened_at, counted_by, counted_at, closed_at, variance_reason,
   sm_signoff_by, fo_signoff_by). One OPEN session per runner (partial unique index).
2. runner_purchases(id, client_mutation_id unique, task_id null, float_session_id null, runner_id,
   supplier_id, sku_id, qty, unit_cost_paisa, amount_paisa, payment_mode ('CASH'|'SUPPLIER_CREDIT'),
   receipt_media_id null, receipt_missing_flag bool, requires_approval bool, approved_by null,
   sync_status ('OK'|'CONFLICT'|'QUARANTINED'), recorded_at (device time), received_at (server),
   created_at).
3. Finance endpoints: POST /api/v1/finance/float/issue {runner_staff_id, issued_float_paisa}
   (FINANCE_OFFICER) → ledger FLOAT_ISSUED (Dr 1020 runner / Cr 1000); POST
   /api/v1/finance/float/:id/count {returned_paisa} → variance = issued − cash purchases +
   supplier cash refunds − returned; zero → CLOSED + FLOAT_RETURNED entry; non-zero →
   VARIANCE_REVIEW, which needs BOTH SOURCING_MANAGER and FINANCE_OFFICER sign-off
   (POST /:id/signoff) before closing with a CASH_SHORTAGE/CASH_OVERAGE entry. GET lists +
   per-runner variance report. Runner: POST /api/v1/runner/float/return (declares the return,
   status PENDING_COUNT); GET /api/v1/runner/float/current.
4. Sync API (architechture.md §11.2): POST /api/v1/runner/sync (FIELD_RUNNER; Idempotency-Key
   on the batch) body {mutations:[{client_mutation_id, type ('PURCHASE'|'TASK_CONTACTED'|
   'OVERRIDE_REQUEST'), payload, recorded_at}]}. Process EACH mutation in its own transaction;
   per-item result {client_mutation_id, result: 'ok'|'conflict'|'quarantined'|'duplicate'|
   'error', server_ids, message}.
   PURCHASE rules: duplicate client_mutation_id → 'duplicate' with the original result; session
   revoked/expired device → 'quarantined' (stored for SOURCING_MANAGER review, nothing posted);
   task cancelled/reassigned while offline → 'conflict': accept the purchase, receive the item into
   GODOWN_NAWABPUR physical stock (RUNNER_CONFLICT_RECEIPT), notify the Sourcing Manager; normal →
   'ok': task PURCHASED, order_item.unit_cost set, ledger RUNNER_CASH_PURCHASE (Dr 1200 / Cr 1020
   runner) or SUPPLIER_CREDIT_PURCHASE (Dr 1200 / Cr 2200 supplier).
   Missing receipt → receipt_missing_flag; amount > RUNNER_PURCHASE_APPROVAL_THRESHOLD (৳2,000)
   without a receipt → requires_approval (SOURCING_MANAGER approves via
   POST /api/v1/admin/sourcing/purchases/:id/approve).
   Also keep the api-spec single-task endpoint POST /api/v1/runner/tasks/:taskId/sync-purchase as a
   thin wrapper over the same service (X-Client-Mutation-Id header).
5. Receipt photos: POST /api/v1/runner/purchases/:id/receipt-upload-url (presigned PUT, image ≤10MB)
   → POST .../receipt-complete; clears the missing flag.
6. Godown receipt: POST /api/v1/admin/godown/receive-runner-items {task_ids[]} (GODOWN_MANAGER/
   QC_TECHNICIAN) → task RECEIVED_AT_GODOWN, units into QC_HOLD (RUNNER_RECEIPT movement), and the
   order advances per P24 §6.
7. Supplier payables: GET /api/v1/finance/supplier-payables; POST /api/v1/finance/supplier-payments
   {supplier_id, amount_paisa, method, reference} → SUPPLIER_PAID entry. Supplier cash refunds for
   rejected batches → POST /api/v1/finance/supplier-refunds (against a float → SUPPLIER_CASH_REFUND
   Dr 1020 / Cr 1200, or as a supplier credit note).

Tests: duplicate sync is harmless (send the same batch 3×); conflict path creates physical stock;
quarantine posts nothing; variance needs two sign-offs; ledger balances per runner sub-ledger.
```

---

# STAGE 8 — TRUST, QC & VERIFICATION

## P26 — QC Records, Seal Minting, Printing, Void & Supervisor Sampling

**Depends on:** P25 · **Docs:** PRD §3.2.1, §3.2.2, §3.2.4, §3.9; architechture.md §7.1, §7.2, §7.5; api-spec §11

```text
Implement QC and seals (module: trust).

1. Tables:
   seal_records(id, seal_id unique CHECK Crockford regex, sku_id, product_tier, order_item_unit_id
   null, manufacturer_serial null (unique per sku when present), status, technician_id,
   warranty_days, warranty_start null, warranty_end null, void_reason null, replaced_by_seal_id
   null, created_at, updated_at). Index manufacturer_serial.
   seal_events (append-only: seal_id, from_status, to_status, actor_id, reason, created_at).
   qc_records(id, seal_id null, order_item_unit_id null, sku_id, qc_type, test_checklist jsonb
   (validated by a Zod schema per qc_type: THREE_POINT = power/voltage, port/function, physical
   integrity + optional readings; NON_INVASIVE = hologram check, box serial matches distributor
   invoice, packaging integrity, factory seal intact; FULL_PRE_DISPATCH = unbox + functional test
   + readings), result ('PASS'|'FAIL'), technician_id, photos media ids, sampled_for_audit bool,
   supervisor_id null, supervisor_result null, supervisor_checked_at null, audit_due_at null,
   escalated_at null, created_at).
   seal_void_requests(id, seal_id, reason (PRINTER_JAM|RIBBON_TEAR|STICKER_DAMAGED), requested_by,
   status, approved_by, decided_at).
2. generateSealId / normalizeSealInput — EXACT code from architechture.md §7.1 (in lib or trust);
   insert with retry on unique collision (max 5 attempts).
3. QC queue: GET /api/v1/qc/queue (QC_TECHNICIAN) — units in QC_HOLD for orders AT_GODOWN_QC,
   pre-orders ARRIVED_GODOWN, RTO/RMA returns (P29/P32) with the expected qc_type: BUDGET_SMART →
   THREE_POINT; AUTHENTIC factory-sealed → NON_INVASIVE; pre-order → FULL_PRE_DISPATCH.
4. POST /api/v1/qc/inspect (api-spec §11.1, extended with order_item_unit_id, qc_type) → qc_record.
   AUTHENTIC requires manufacturer_serial. FAIL → the unit goes to DAMAGED or the supplier-return
   flow: record a supplier QC outcome (P13 recordQcOutcome; 3-of-5 batch rule) and create a
   SUPPLIER_RETURN runner task + a replacement sourcing task for the order line.
   PASS → 5% random sampling (crypto random < QC_SAMPLING_BP) sets sampled_for_audit and
   audit_due_at = now + 120 min.
5. POST /api/v1/qc/mint-seal {qc_record_id} (QC_TECHNICIAN; requires a PASS record) → seal GENERATED
   → returns {seal_id, label: {tspl, zpl, qr_url: https://ncamart.com/verify?q=NCA-XXXX-XXXX,
   tier_mark}} → status PRINTED once the client confirms POST /api/v1/qc/seals/:sealId/printed.
   Provide label builders for TSPL and ZPL (50×30 mm) with QR + Seal ID + tier mark.
6. Activation: POST /api/v1/qc/seals/:sealId/apply {order_item_unit_id} → ACTIVE only if a PASS
   qc_record exists; link the unit (order_item_units.seal_id, manufacturer_serial); seal event.
   Units move QC_HOLD → GODOWN_NAWABPUR (QC_RELEASE) / or stay allocated to the order.
7. Void & re-print (PRD §3.2.4): POST /api/v1/qc/void-seal {seal_id, reason} (QC_TECHNICIAN) creates
   a void request; POST /api/v1/qc/void-requests/:id/approve (GODOWN_MANAGER or SOURCING_MANAGER,
   seal.void.approve) → seal VOID_PRINT_ERROR (only from GENERATED/PRINTED), mint a NEW seal for the
   same qc_record (never reuse an ID), link replaced_by_seal_id. Keep api-spec's response.
8. Supervisor sampling: GET /api/v1/qc/sampling-queue (GODOWN_MANAGER); POST
   /api/v1/qc/records/:id/supervisor-audit {result, notes}. Packing (P28) is BLOCKED for orders with
   a pending sampled unit. Job every 5 min: sampled records past audit_due_at without supervisor
   check → escalate to SUPER_ADMIN (Class A internal) once.
9. When every unit of an order has an ACTIVE seal and no pending audits → the order is ready for
   packing (emit 'order.qc_completed'). For pre-orders, QC pass of all units →
   QC_VERIFIED_BALANCE_DUE (P23).
10. Customer "My Warranties" (finish P08 §4): list ACTIVE/CLAIMED seals linked to the customer's
    delivered order units with the warranty countdown (api-spec §3.3).

Tests: Crockford generator distribution + regex; normalizer maps O→0 and I/L→1, strips spaces/
hyphens; activation without a PASS fails; void creates a new ID and the old one is
VOID_PRINT_ERROR; sampling rate ~5% over 10k simulated passes; escalation fires once.
```

---

## P27 — `/verify` Portal, Rate Limits & Cloned-Seal Detection

**Depends on:** P26 · **Docs:** PRD §3.2.3, Flow 4; architechture.md §7.3, §7.4; api-spec §8, §16.1

```text
Implement public verification (module: trust).

1. seal_verifications(id bigserial, seal_id null, query_raw, query_type ('SEAL'|'SERIAL'), found bool,
   device_id, ip inet, geo_district null, user_agent, is_qr bool, created_at) — RANGE-partitioned
   monthly by created_at (SQL migration + a job that creates next month's partition on the 25th and
   drops partitions older than 12 months).
2. Endpoints (public): GET /api/v1/verify/:sealId (api-spec) AND GET /api/v1/verify?q=&qr=1
   (architechture.md; accepts a Seal ID or a manufacturer serial).
   - Normalize input; invalid format → 404 with the api-spec message.
   - Rate limits: 5/min per device (nca_did) and 60/min per IP. On exceed → 429 with
     {"challenge":"turnstile"}; the client retries with header X-Turnstile-Token, verified
     server-side; repeated abuse (3 exceeds in 10 min) → 15-min block for that device/IP.
   - Geo district from Cloudflare headers (CF-IPCity/region) or a pluggable GeoIP resolver (mock in
     dev). Never fingerprint.
   - Response (api-spec §8.1): is_valid, seal_id, product_tier + badge, product (title en/bn,
     brand, image), manufacturer serial (AUTHENTIC only), qc_verified_at, technician code (not
     name), warranty {status ACTIVE|EXPIRED|NOT_STARTED|CLAIMED, days total, starts/expires,
     coverage_type}, start_claim_url. VOID_PRINT_ERROR seals return is_valid:false with a generic
     message.
   - IMPORTANT (PRD wins over api-spec): the clone alert is INTERNAL ONLY — the public response
     never reveals the clone suspicion; always show standard info. Record this in DECISIONS.md.
   - Log every lookup to seal_verifications; outbox analytics 'verify_lookup' (and 'qr_scan').
3. Clone detection job every 5 min: EXACT SQL from architechture.md §7.3 (≥5 distinct devices AND
   ≥2 distinct districts in 24h) + immediate alert on any lookup of a VOID_PRINT_ERROR seal.
   seal_clone_alerts(id, seal_id, reason ('MULTI_DEVICE_MULTI_DISTRICT'|'VOID_SEAL_LOOKUP'),
   distinct_devices, distinct_districts text[], total_scans_24h, status ('OPEN'|'INVESTIGATING'|
   'DISMISSED'|'CONFIRMED_CLONE'), created_at, resolved_by, notes). Dedupe per seal per 24h.
   Emit 'security.cloned_seal_suspected' (Class A internal → SUPER_ADMIN via SMS/WhatsApp/email).
4. Admin: GET /api/v1/admin/security/clone-alerts (api-spec §16.1), POST .../:id/resolve.
5. Warranty expiry job daily 02:30: ACTIVE seals with warranty_end < now → EXPIRED.

Tests: the device limit triggers before the IP limit for one device; CGNAT scenario (60 devices
behind one IP, 1 req each) passes; Turnstile retry path; clone SQL with fixtures (4 devices/3
districts → no alert; 5 devices/2 districts → alert; dedupe); void-seal lookup alerts
immediately; partition maintenance.
```

---

# STAGE 9 — LOGISTICS

## P28 — Packing, Dispatch Queue & Courier Booking

**Depends on:** P27 · **Docs:** PRD §3.7; architechture.md §12; api-spec §12.1, §12.2

```text
Implement dispatch and courier booking (module: logistics).

1. Courier adapter interface EXACTLY as architechture.md §12 (createShipment, createReturnPickup?,
   getStatus, parseWebhook, fetchSettlements?). Implement: steadfast, pathao, redx (HTTP clients
   with env credentials; write them against the public API docs, map fields carefully, unknown parts
   marked TODO-VERIFY per Phase 0 checklist) and a mock adapter (deterministic consignment numbers,
   simulated status progression via a dev endpoint POST /api/v1/_dev/courier/:consignment/advance).
2. courier_shipments(id, order_id, courier, direction ('FORWARD'|'REVERSE'), consignment_no unique
   null until booked, tracking_url, status ('PENDING_BOOKING'|'BOOKED'|'PICKED_UP'|'IN_TRANSIT'|
   'OUT_FOR_DELIVERY'|'DELIVERED'|'PARTIALLY_DELIVERED'|'RTO_IN_TRANSIT'|'RETURNED'|'LOST'|
   'BOOKING_FAILED'|'CANCELLED'), weight_grams, expected_cod_paisa, collected_cod_paisa null,
   delivery_charge_paisa null, cod_charge_paisa null, return_charge_paisa null, booking_attempts,
   last_error, booked_at, handed_over_at, delivered_at, last_event_at, created_at) +
   courier_events(id, shipment_id, raw_status, normalized_status, payload jsonb, occurred_at,
   received_at, dedupe_key unique).
3. Dispatch queue: GET /api/v1/logistics/dispatch-queue (DISPATCH_STAFF; SHIPPING PII serializer,
   audit pii.read.shipping) — orders whose units all have ACTIVE seals and no pending sampled audits,
   grouped by fulfillment channel.
4. POST /api/v1/logistics/orders/:orderId/pack {package_weight_grams, unit_seal_confirmations:
   [{order_item_unit_id, seal_id}]} → verify each scanned seal matches the unit, transition PACKED;
   for PICKUP → READY_FOR_PICKUP (P30 generates the PIN); for COURIER → create a shipment
   PENDING_BOOKING with expected_cod = order.cod_amount and enqueue booking.
5. Booking job (queue courier): calls adapter.createShipment with mapped location IDs
   (courier_location_map; missing mapping → BOOKING_FAILED with a clear error). Retries at 1m, 5m,
   15m, 30m (custom backoff); after the last failure → BOOKING_FAILED + it appears in the manual
   console. Courier choice: default per zone from settings (e.g. inside Dhaka → STEADFAST);
   POST /api/v1/logistics/book-consignment (api-spec §12.2) lets staff book/re-book manually or
   switch courier in one click.
6. Manual console: GET /api/v1/logistics/manual-console (failed bookings, manual reverse pickups);
   POST /api/v1/logistics/shipments/:id/manual-booking {consignment_no, tracking_url} for couriers
   without an API.
7. Handover: POST /api/v1/logistics/shipments/handover {shipment_ids[]} (scan at pickup) →
   HANDED_TO_COURIER for each order, handed_over_at set (the advance fee becomes non-refundable from
   now). Notification 7 "Out for delivery" is triggered by the courier status (P29).
8. Shipping label: return the courier's label URL if provided, else generate a simple PDF label
   (order no, consignee from the SHIPPING DTO, COD amount, barcode of the consignment).

Tests: packing rejects a wrong seal; booking retry schedule and fallback to the manual console;
COD amount on the shipment equals order.cod_amount; dispatch PII audit row.
```

---

## P29 — Courier Webhooks, Delivery, RTO & Warranty Start

**Depends on:** P28 · **Docs:** PRD §3.6.2, §3.7 (partial delivery), §3.8.7, Flow 7; architechture.md §8.3, §9.3, §12; api-spec §12.3

```text
Implement tracking and delivery outcomes (modules: logistics, orders, ledger, trust).

1. POST /api/v1/logistics/webhooks/:courier (also alias /api/v1/webhooks/couriers/:courier):
   adapter.parseWebhook verifies courier auth (secret header/token per courier) → normalized events
   → store courier_events (dedupe) → apply in a transaction. Unknown consignment → log + 200.
   Out-of-order events: never move backwards (status rank); terminal statuses are final.
2. Status normalization tables per adapter (e.g. Steadfast 'delivered', Pathao 'Delivered' →
   DELIVERED; partial → PARTIALLY_DELIVERED; return statuses → RTO_IN_TRANSIT).
3. Polling fallback job every 30 min: shipments not terminal with no event for 24h → adapter.getStatus.
4. On DELIVERED (one transaction):
   - order → DELIVERED; items DELIVERED; customers.delivered_order_count += 1.
   - Revenue recognition: ledger REVENUE_RECOGNIZED_DELIVERY (prepaid part from 2000/2010, COD
     part Dr 1110 courier sub-ledger, coupon discount 4010, Cr 4000 net ex-VAT + discount, Cr 2100
     VAT, Cr 4020 delivery fee) + COGS_RECOGNIZED (Dr 5000 / Cr 1200 at unit cost).
   - Warranty start for every unit seal: warranty_start = delivered event time,
     warranty_end = start + warranty_days.
   - Issue the Mushak invoice if requested (P22).
   - Outbox: notification, analytics, review invitation scheduled at +3 days (P38).
5. PARTIALLY_DELIVERED: request body/adapter gives the delivered lines; recognize revenue only for
   delivered lines; COD receivable = collected amount; returned lines follow RTO.
6. RTO_IN_TRANSIT: order → RTO_IN_TRANSIT; customers.rto_count_12m recompute (see 8); if ≥ 2 →
   cod_blocked = true (reason AUTO_RTO) + audit system row.
   RTO receipt: POST /api/v1/logistics/rto/:shipmentId/receive {units:[{order_item_unit_id,
   seal_intact: bool, notes, photos}]} (QC_TECHNICIAN, GODOWN_MANAGER, DISPATCH_STAFF) →
   RTO_RECEIVED; seal intact → restock GODOWN_NAWABPUR (RTO_RETURN movement) or flag for supplier
   return; damaged → DAMAGED location + courier damage claim record (courier_claims table: id,
   shipment_id, amount_paisa, status, notes). Ledger RTO_ADVANCE_FEE_RETAINED (Dr 2000 / Cr 4020)
   if an advance fee was paid; refund any other prepaid amounts (refund request, P33). Return
   charges are booked at settlement (P34).
7. Warranty start fallback job daily 02:00: DELIVERED-less shipments that were HANDED_TO_COURIER
   with no delivered event → if dispatch + 3 days (inside Dhaka) / + 5 days (outside) has passed
   AND the courier status isn't returned → set warranty_start = that fallback date (do NOT mark the
   order delivered; log a decision).
8. rto_count_12m recompute job daily 03:00 (rolling 12 months from shipment history, not a
   lifetime counter); also recompute on each RTO event for that customer. Unblock automatically
   when the count drops below 2 ONLY if the block reason was AUTO_RTO.
9. Support override: POST /api/v1/admin/customers/:id/cod-block {blocked, reason}
   (CUSTOMER_SUPPORT; audit-logged with a reason).

Tests: webhook auth rejection; duplicate events idempotent; DELIVERED posts balanced revenue + COGS
with exact numbers for a COD order with coupon; partial delivery splits correctly; 2nd RTO in 12
months blocks COD, 13-month-old RTO not counted; warranty fallback dates.
```

---

# STAGE 10 — SHOWROOM POS

## P30 — Showroom Pickup PIN, Walk-In Sales & Cash Drawer

**Depends on:** P29 · **Docs:** PRD §3.7 (pickup + walk-in), Flow 6, §3.13.6; architechture.md §10.6; api-spec §9

```text
Implement showroom operations (module: pos).

1. cash_drawer_sessions(id, staff_id, opening_float_paisa, cash_sales_paisa, cash_refunds_paisa,
   expected_cash_paisa, counted_cash_paisa null, variance_paisa null, status ('OPEN'|'COUNTED'|
   'VARIANCE_REVIEW'|'CLOSED'), opened_at, counted_at, closed_at, reconciled_by, notes). One OPEN
   drawer per staff. POS operations that take cash require an OPEN drawer.
   POST /api/v1/pos/drawer/open {opening_float_paisa}; POST /api/v1/pos/drawer/close
   {counted_cash_paisa} → variance = counted − expected; FINANCE_OFFICER reconciles via
   POST /api/v1/finance/drawers/:id/reconcile → CASH_SHORTAGE/OVERAGE ledger entry against 1010.
2. Pickup PIN: when an order becomes READY_FOR_PICKUP → generate a 6-digit PIN, store
   HMAC-SHA256(pepper, orderId + pin), expires in 7 days, send via SMS (notification 9, Class B).
   Support can reset/regenerate: POST /api/v1/admin/orders/:id/pickup-pin/reset (unlocks).
3. POST /api/v1/pos/pickup/verify-pin {order_number, pickup_pin} (SHOWROOM_POS_STAFF): constant-time
   compare; wrong → attempts += 1, 401 ERR_INVALID_PIN with remaining attempts; 5th wrong → locked →
   423/403 ERR_PIN_LOCKED. Expired → 410. Success response as api-spec §9.1 (COUNTER PII serializer:
   name + masked phone), plus amount_due_at_counter.
4. POST /api/v1/pos/pickup/handover {order_id, customer_inspected_on_bench, signed_handover_slip,
   payment?: {method ('CASH'|'BKASH_QR'|'NAGAD_QR'|'CARD_TERMINAL'), amount_paisa, reference}}
   (Idempotency-Key) → if amount due > 0, require payment equal to the due amount; record a payment
   transaction (method + reference); add cash to the drawer; DELIVERED_COUNTER; revenue recognition
   (counter part Dr 1010/1040/1030); warranty start = handover time; stock already committed;
   receipt payload (for thermal printing, ESC/POS-friendly text + JSON).
5. Unclaimed pickups job daily 09:30: reminders on Day 3 and Day 6 (Class B); Day 8 unpaid →
   PICKUP_EXPIRED → cancel: stock back to sellable SHOWROOM/GODOWN, refund the advance if any;
   prepaid orders are held up to 14 days, then a support task (arrange courier delivery or refund).
6. Walk-in sale: POST /api/v1/pos/walk-in-sale (api-spec §9.3, Idempotency-Key):
   {customer_phone (required; find-or-create customer, OTP optional), items:[{sku_id, seal_id}],
   payment_mode, paid_amount_paisa, reference?, coupon_code?}. Rules: every item must already carry
   an ACTIVE seal that is in SHOWROOM_COUNTER stock and not linked to another order; price
   server-side (VAT-inclusive); create an order channel SHOWROOM_POS, fulfillment WALK_IN, status
   DELIVERED_COUNTER directly (special path); decrement showroom stock (POS_SALE); ledger
   POS_WALKIN_SALE + COGS; seals linked and warranty started now; cash added to the drawer; return a
   receipt payload. 201 response.
7. Showroom stock view: GET /api/v1/pos/stock?q= (sellable showroom units with seals).

Tests: PIN lockout after 5; expiry; handover requires full payment; walk-in rejects a seal not in
showroom stock; drawer expected-cash math; Day-8 expiry flow.
```

---

# STAGE 11 — MEDIA, RMA & REFUNDS

## P31 — Media Uploads (Presigned Multipart to R2)

**Depends on:** P30 · **Docs:** PRD §3.8.8, §3.18.1; architechture.md §5.5 (media), §18; api-spec §13.1

```text
Implement generic media uploads (module: media).

1. POST /api/v1/media/uploads {purpose ('RMA_PHOTO'|'RMA_VIDEO'|'RECEIPT_PHOTO'|'QC_PHOTO'|
   'REFUND_PROOF'|'PRODUCT_IMAGE'), file_name, content_type, size_bytes, owner_type?, owner_id?}
   → validates per-purpose limits:
   RMA_PHOTO: JPG/PNG/WebP/HEIC, ≤10 MB each, max 5 per claim;
   RMA_VIDEO: MP4/MOV/WebM, ≤300 MB, max 1 per claim, ≤3 minutes (duration checked after upload via
   ffprobe in a worker job if available; otherwise trust the client-declared duration and flag it).
   Small files (≤10 MB) → single presigned PUT; large files → S3 multipart: returns upload_id,
   part_size (10 MB), presigned part URLs (or an endpoint to fetch part URLs lazily:
   POST /api/v1/media/uploads/:id/parts {part_numbers}) — resumable.
   Keep the api-spec alias POST /api/v1/rma/upload-url.
2. POST /api/v1/media/uploads/:id/complete {parts?: [{part_number, etag}]} → complete multipart,
   headObject verifies size & content type, status READY, emit 'media.uploaded' (post-processing:
   duration probe, image dimension read).
3. POST /api/v1/media/uploads/:id/abort.
4. Access: media is private by default; GET /api/v1/media/:id/url returns a signed GET URL (5 min) if
   the actor owns it or has permission (support for RMA, finance for refund proofs). Product images
   are public via the CDN base URL.
5. Retention job daily 05:00: delete objects whose retention_until has passed (RMA media 180 days
   after claim closure; QC photos warranty end + 1 year; receipts per the finance retention setting),
   mark DELETED, audit-system row.
6. Abandoned uploads cleanup: PENDING_UPLOAD older than 24h → abort multipart + delete.

Tests (MinIO): multipart happy path; size/type rejection; access control on signed URLs; retention.
```

---

## P32 — Warranty Claims (RMA), Reverse Logistics & Distributor Liaison

**Depends on:** P31 · **Docs:** PRD §3.8, Flow 9, Flow 10, §10 (courier damage, distributor refusal); api-spec §13.2, §13.3

```text
Implement RMA (module: rma).

1. warranty_claims(id, claim_number unique (RMA-YYYY-NNNN), seal_id, order_id, order_item_unit_id,
   customer_id, claim_type ('DOA'|'BUDGET_7_DAY'|'AUTHENTIC_WARRANTY'|'TRANSIT_DAMAGE'),
   issue_description, status ('SUBMITTED'|'UNDER_REVIEW'|'APPROVED'|'REJECTED'|'REVERSE_PICKUP'|
   'RECEIVED'|'INSPECTING'|'DISTRIBUTOR_LIAISON'|'RESOLVED'|'CLOSED'), priority ('DOA_FAST_TRACK'|
   'NORMAL'), decision, rejection_reason ('SEAL_TAMPERED'|'PHYSICAL_DAMAGE'|'LIQUID'|
   'SEVERED_CABLE'|'OUT_OF_WARRANTY'|'NO_DEFECT_FOUND'|'OTHER'), resolution ('REPLACE'|'REPAIR'|
   'REFUND'|'STORE_CREDIT'), reverse_shipment_id null, replacement_order_id null, sla_due_at,
   adjudicated_by, adjudicated_at, closed_at, created_at) + claim_events (append-only) + claim media
   links via media_assets owner.
2. POST /api/v1/rma/claims (customer; also allowed from /verify via an authenticated session)
   {seal_id, issue_description, media_ids[], is_doa, wants_assisted_transit?}:
   eligibility: the seal is ACTIVE/linked to the customer's delivered unit (or the customer proves
   ownership — warranties follow the Seal ID, not the phone: allow any logged-in customer to claim a
   seal, but flag non-original owners for Support), within the warranty window;
   DOA → within 48h of warranty_start and a video is mandatory; BUDGET_SMART → 7-day replacement
   window; AUTHENTIC beyond 30 days → the response includes the official service center info
   (from the brand/distributor record) and an option for "NCAMart Assisted Warranty Transit".
   SLA: 72h (Dhaka) / 5 business days (outside). Response as api-spec §13.2 (adjust the message to
   "within 1 hour" per PRD notification SLA).
3. Support: GET /api/v1/rma/claims (CUSTOMER_SUPPORT queue, DOA first), GET /:claimNumber,
   POST /api/v1/rma/claims/:claimNumber/adjudicate {decision: 'APPROVED_FOR_RETURN'|'REJECTED',
   rejection_reason?, notes} → APPROVED → book the reverse pickup (adapter.createReturnPickup if
   supported, else a manual booking task in the dispatch console) → REVERSE_PICKUP. Notification 10
   (Class B, within 1 hour).
   DOA fast track: allow "replace before return" — POST /:claimNumber/dispatch-replacement creates a
   zero-price replacement order (REGULAR, physical or virtual sourcing) within 24h.
4. Receipt & inspection: POST /api/v1/rma/claims/:id/receive (into RMA_HOLD) → POST
   /api/v1/rma/claims/:id/inspect (QC_TECHNICIAN) {verified_defect, seal_intact, notes, photos,
   resolution}: seal broken/tampered → reject (exclusion); defect verified →
   REPLACE (replacement order, the defective unit goes to supplier return/DAMAGED, seal → CLAIMED,
   the new unit gets a new seal inheriting the remaining warranty — record the decision) |
   REFUND (refund request P33, amount = paid for that line) | STORE_CREDIT (if the customer chooses).
5. Distributor liaison (AUTHENTIC): POST /api/v1/rma/claims/:id/liaison → creates a WARRANTY_LIAISON
   runner task batch (group by distributor: Star Tech/Ryans/Excel), tracks sent/returned dates;
   POST /:id/liaison/returned {outcome: 'REPAIRED'|'REPLACED'|'REFUSED'} → courier back to the
   customer (FORWARD shipment). REFUSED → the NCAMart 100% Authentic Guarantee: replacement or
   refund within 48h (create a high-priority support task).
6. Transit damage claim: claim_type TRANSIT_DAMAGE with an unboxing video → immediate replacement
   within 24h + a courier_claims record for insurance (P29).
7. Customer: GET /api/v1/customer/claims, GET /api/v1/customer/claims/:claimNumber (timeline).
8. Media retention: on claim CLOSED set retention_until = closed_at + 180 days on its media.

Tests: DOA 48h boundary; 7-day window for Budget; tampered seal rejection; reverse pickup booking
fallback to manual; replacement flow updates the seal statuses; TAT due dates.
```

---

## P33 — Refunds (Approval Limits, Gateway/Manual Execution, Store Credit)

**Depends on:** P32 · **Docs:** PRD §3.14.1–3.14.5, Flow 13; architechture.md §9.2; api-spec §14.3

```text
Implement refunds (module: payments/refunds + ledger).

1. refunds(id, refund_number (REF-YYYY-NNNNN), order_id, order_item_ids uuid[], payment_tran_id null,
   amount_paisa, reason ('CUSTOMER_CANCELLATION'|'STOCKOUT'|'PREORDER_IMPORT_FAILED'|
   'PREORDER_DELAY_CANCEL'|'REPRICING_REJECTED'|'RMA_REFUND'|'OVERPAYMENT'|'RTO_PREPAID_RETURN'|
   'RISK_REJECTED'|'STOCKOUT_AFTER_LATE_PAYMENT'|'OTHER'), method ('GATEWAY'|'BKASH'|'NAGAD'|'BANK'|
   'STORE_CREDIT'), status ('REQUESTED'|'APPROVED'|'PROCESSING'|'COMPLETED'|'FAILED'|'REJECTED'),
   is_before_delivery bool, requested_by_type/id, approved_by, approved_at, executed_by,
   executed_at, external_ref, proof_media_id, gateway_refund_ref, payout_account (bKash/Nagad number
   or bank details, encrypted), due_by (approved_at + 7 working days), created_at) + refund_events.
2. Requests come from: system events ('refund.requested' from P21/P22/P23/P24/P29/P32) and staff
   POST /api/v1/admin/refunds (support). Amount is computed server-side with
   refundableAmountForLines (P15) — never trusted from input; cap total refunds at paid_total.
   System-generated refunds for full cancellations before fulfillment are auto-approved by the
   SYSTEM actor (record the decision); all others need approval.
3. Approval: POST /api/v1/admin/refunds/:id/approve — limits via permission refund.approve
   (Support ≤ ৳1,000; Finance ≤ ৳20,000; Super Admin above). Reject with a reason.
4. Method selection (PRD §3.14.3): online payment with bank_tran_id → GATEWAY via the SSLCommerz
   refund API (initiate, store refund_ref_id, poll the status job every 30 min until final);
   COD/manual → FINANCE_OFFICER executes a manual payout: POST /api/v1/finance/refunds/execute
   (api-spec §14.3; keep the path) {refund_id, method, external_ref, proof_media_id} →
   COMPLETED; STORE_CREDIT only if the customer explicitly chose it (customer endpoint
   POST /api/v1/orders/:orderNumber/refunds/:id/choose-store-credit before execution) → credit
   issued as withdrawable, never-expiring.
5. Ledger: REFUND_BEFORE_DELIVERY (Dr 2000/2010 → Cr 1100 gateway | 1040/1030 manual | 2020 credit)
   or REFUND_AFTER_DELIVERY (Dr 4040 + 2100 → Cr ...; returned unit Dr 1200 / Cr 5000 at cost if
   restocked). Recompute the order payment_status. Notification 4 (Class A) on completion.
6. SLA monitor job hourly: approved refunds not initiated within 24h → alert finance; not completed
   by due_by → escalate to SUPER_ADMIN.
7. Lists: GET /api/v1/admin/refunds (filters by status/method/overdue), customer view in order detail.

Tests: approval limit boundaries (৳1,000 ok for support, ৳1,000.01 not); gateway refund mock
success/failure; cannot refund more than paid; ledger correctness before vs after delivery;
store credit choice path.
```

---

# STAGE 12 — FINANCE RECONCILIATION & REPORTS

## P34 — Courier COD & Gateway Settlement Reconciliation

**Depends on:** P33 · **Docs:** PRD §3.13.3, §3.13.5, Flow 11; architechture.md §10.4, §10.5; api-spec §14.2

```text
Implement settlements (module: finance).

1. courier_settlements(id, courier, payout_ref, payout_date, gross_collected_paisa,
   total_charges_paisa, net_paisa, source ('API'|'CSV'), file_media_id null, imported_by, status
   ('IMPORTED'|'MATCHING'|'MATCHED'|'HAS_EXCEPTIONS'|'CLOSED'), created_at) unique(courier,
   payout_ref); courier_settlement_lines(id, settlement_id, consignment_no, shipment_id null,
   collected_paisa, delivery_charge_paisa, cod_charge_paisa, return_charge_paisa, match_status
   ('PENDING'|'MATCHED'|'SHORT_PAID'|'OVER_PAID'|'UNKNOWN_CONSIGNMENT'|'RESOLVED'), variance_paisa,
   resolution_notes, resolved_by).
   settlement_exceptions(id, kind ('SHORT_PAID'|'OVER_PAID'|'MISSING'|'UNKNOWN_CONSIGNMENT'|
   'GATEWAY_UNMATCHED'), ref ids, amount_paisa, status ('OPEN'|'FOLLOWING_UP'|'RESOLVED'|
   'WRITTEN_OFF'), age_days, notes).
2. CSV import: POST /api/v1/finance/reconciliation/courier-csv (multipart: courier_partner,
   csv_file) and alias POST /api/v1/finance/courier-settlements. Per-courier CSV column mappers
   (configurable mapping in settings since formats are TODO-VERIFY). Parse with papaparse; validate
   rows; idempotent per payout_ref. API import: daily job calls adapter.fetchSettlements where
   supported.
3. Matching job (per settlement): match lines by consignment_no to courier_shipments; compare
   collected vs expected_cod (delivered lines only for partial deliveries); exact → MATCHED and post
   COURIER_PAYOUT_MATCHED (Dr 1030 net + 5100 + 5110 + 5120 / Cr 1110 courier); store the charges on
   the shipment. Mismatch → SHORT_PAID/OVER_PAID exception; unknown → UNKNOWN_CONSIGNMENT. Response
   summary as api-spec §14.2.
4. MISSING detection job daily 09:00: delivered shipments not present in any payout after 7 days →
   MISSING exception; courier receivable aging buckets (0–7, 8–15, 16–30, 30+ days). Class A
   internal alert if any item is older than 7 days (KPI: zero unreconciled > 7 days).
5. Exception workflow: GET /api/v1/finance/exceptions, POST /:id/resolve {resolution:
   'RECEIVED_LATER'|'ADJUSTED'|'WRITE_OFF', notes} (write-off posts an expense entry; record the
   account decision).
6. Gateway settlements: gateway_settlements + lines (tran_id, amount_paisa, fee_paisa,
   match_status). POST /api/v1/finance/gateway-settlements (CSV from SSLCommerz) → match by tran_id
   → GATEWAY_SETTLEMENT_MATCHED (Dr 1030 net + 5200 fee / Cr 1100); unmatched → exceptions.
7. Dashboard counts endpoint: GET /api/v1/finance/dashboard (open exceptions by kind, receivable
   aging, unreconciled gateway total, open float sessions, open drawers, pending refunds).

Tests: a CSV with a matched line, a short line, an unknown line → the right statuses and ledger;
re-importing the same payout_ref is a no-op; MISSING after 7 days; gateway fee posting.
```

---

## P35 — Financial Reports & Exports

**Depends on:** P34 · **Docs:** PRD §3.13.7, §3.17 (KPIs); architechture.md §10.7

```text
Implement reports (module: finance; permissions ledger.read / reports.export).

Endpoints under /api/v1/finance/reports/* with ?from=&to=&format=json|csv|xlsx (exceljs for xlsx,
streamed; Bangla-safe UTF-8 with BOM for CSV):
1. trial-balance (as of a date)
2. profit-and-loss (period; revenue, contra revenue, COGS, gross margin, expenses, net)
3. courier-receivable-aging (by courier, buckets)
4. customer-deposits (account 2010 balance per open pre-order)
5. store-credit-liability (2020 per customer, withdrawable vs goodwill, upcoming expiries)
6. runner-float-status (open sessions, variances per runner over the period)
7. supplier-payables (2200 per supplier with aging)
8. vat-sales-register (per invoice: date, invoice/Mushak no, buyer BIN, net, VAT by rate, total)
9. refunds-register (status, method, SLA breaches)
10. kpi-operations (from operational data): conversion inputs, return/replacement rate per tier,
    DOA rate, RTO rate, avg Dhaka delivery time, RMA TAT, pre-order fulfilment rate, supplier
    defect scores, verification engagement rate (lookups ÷ delivered orders), gross margin per
    Drop-and-Pack order, unreconciled settlement count.
Heavy reports run as jobs when the range > 90 days: POST .../exports → job → private R2 file →
GET /api/v1/finance/exports/:id (signed URL).

Tests: trial balance totals equal; P&L ties to ledger balances in a seeded scenario; CSV encoding
of Bangla names; KPI formulas on fixtures.
```

---

# STAGE 13 — NOTIFICATIONS & REALTIME

## P36 — Multi-Channel Notifications (Class A/B/C, Quiet Hours, Fallback)

**Depends on:** P35 (can be pulled earlier if needed) · **Docs:** PRD §3.10 (matrix); architechture.md §13

```text
Implement notifications (module: notifications). Replace all earlier mock "log only" sends.

1. Provider interfaces: SmsProvider (primary + secondary route; implement a generic BD SMS gateway
   HTTP client configurable by env, plus mock), WhatsAppProvider (WhatsApp Cloud API templates,
   plus mock), EmailProvider (SMTP/nodemailer → mailpit in dev). Each returns a provider message ID.
2. notification_templates(code, channel, locale ('bn'|'en'), class, body/subject with {{vars}},
   whatsapp_template_name, is_active). Seed templates for EVERY trigger in the PRD §3.10 matrix
   (1 OTP … 12 Cloned seal alert), plus internal alerts used earlier (override escalation, supplier
   suspended, stock check mismatch, payment mismatch, refund SLA, sampling escalation, outbox lag).
   Bangla templates use Bangla numerals for amounts.
3. notification_logs(id, recipient_type, recipient_id, to_address, channel, template_code, class,
   status ('QUEUED'|'SCHEDULED'|'SENT'|'DELIVERED'|'FAILED'|'DEAD_LETTER'|'SKIPPED_OPT_OUT'),
   provider, provider_message_id, attempts, scheduled_at, sent_at, error, payload jsonb, created_at).
4. notify(event) service: resolve recipients and channels per the matrix → for each message compute
   nextAllowedSendTime(class) (A immediate; B/C 08:00–22:00 Dhaka, else delayed to 08:00) → enqueue a
   BullMQ delayed job. Class C requires marketing_opt_in = true and appends an opt-out text/link
   (GET /api/v1/notifications/opt-out?token= signed token). Specific timing rules: balance
   reminders at 10:00; "Out for delivery" on the morning of delivery.
5. Circuit breaker on the primary SMS provider: > 10% failures over 5 minutes (min 20 sends) → route
   to WhatsApp or the secondary SMS for 10 minutes, then half-open trial (store state in Redis).
6. Retries with backoff; Class A messages that exhaust retries → DEAD_LETTER visible to Support:
   GET /api/v1/admin/notifications/dead-letter, POST .../:id/retry.
7. Delivery receipts webhooks (where the provider supports them): POST
   /api/v1/webhooks/notifications/:provider → update status.
8. Wire all outbox events from earlier prompts to templates (make a single mapping file
   src/modules/notifications/event-map.ts and a test asserting every PRD matrix row is mapped).
9. Customer preferences: PUT /api/v1/customer/notification-preferences {marketing_opt_in,
   whatsapp_opt_in, email_opt_in}.

Tests: a Class B event at 23:30 Dhaka is scheduled for 08:00 next day; Class A at 03:00 sends now;
Class C skipped without opt-in; circuit breaker opens and recovers; dead-letter after max retries;
the matrix coverage test.
```

---

## P37 — Realtime Staff Alerts (SSE over Redis Pub/Sub)

**Depends on:** P36 · **Docs:** architechture.md §5.5 (Realtime), §17.2

```text
Implement GET /api/v1/events/stream (staff sessions only) as Server-Sent Events.

1. On connect: authenticate the staff session, compute the channels from roles (e.g.
   role:SOURCING_MANAGER, role:GODOWN_MANAGER, staff:{id}, all-staff), subscribe through a shared
   Redis subscriber (one per process, fan-out in memory).
2. Event format: id, event (e.g. 'sourcing.override_requested', 'qc.sampling_due',
   'security.cloned_seal', 'payment.hold_review', 'order.new_pickup', 'dispatch.booking_failed'),
   data (PII-free JSON, links by id). Heartbeat comment every 25s. Support Last-Event-ID replay
   from a Redis stream (XADD capped at ~1000 per channel, 24h).
3. publishStaffEvent(channel, event) used by outbox handlers (worker → Redis → any web replica).
4. Acknowledgements: POST /api/v1/events/:eventId/ack (used by the 5-minute sourcing escalation).
5. Connection limits: max 3 concurrent streams per staff; close on session revoke (check every 60s).

Tests: two simulated web replicas both deliver an event published by the worker; Last-Event-ID
replay; revoked session closes the stream.
```

---

# STAGE 14 — ENGAGEMENT, ANALYTICS & FEEDS (PHASE 1.5 INCLUDED)

## P38 — Reviews, Wishlist, Back-in-Stock & Abandoned Cart

**Depends on:** P37 · **Docs:** PRD §3.16.2–3.16.4

```text
Implement engagement features (module: engagement).

1. Verified reviews: reviews(id, order_item_id unique, customer_id, product_id, sku_id, tier,
   rating 1–5, title, body, media_ids, status ('PENDING'|'APPROVED'|'REJECTED'), moderated_by,
   moderated_at, created_at). Only customers with a DELIVERED/DELIVERED_COUNTER item can review it;
   no incentives (no coupons tied to reviews). Invitation 3 days after delivery (Class B) via a
   delayed job scheduled in P29. Endpoints: POST /api/v1/reviews, GET
   /api/v1/catalog/products/:slug/reviews (approved only, tier badge per review, rating summary),
   moderation GET/POST /api/v1/admin/reviews/:id/moderate (CUSTOMER_SUPPORT). Approved reviews
   update a cached rating summary on the product (search doc too).
2. Wishlist: wishlist_items(customer_id, product_id, sku_id null, created_at) PK; GET/POST/DELETE
   /api/v1/customer/wishlist.
3. Back-in-stock: stock_alert_subscriptions(id, customer_id, sku_id, status ('ACTIVE'|'NOTIFIED'|
   'CANCELLED'), created_at, notified_at); POST /api/v1/catalog/skus/:skuId/notify-me; on
   'inventory.availability_changed' to IN_STOCK/AVAILABLE → Class C notification (opt-in only,
   08:00–22:00), mark NOTIFIED.
4. Abandoned cart: server-side carts for logged-in customers: carts(customer_id pk, items jsonb,
   updated_at, reminded_at). PUT /api/v1/cart (sync), GET /api/v1/cart. Job hourly: carts updated
   2–24h ago, with no order since, not reminded in 7 days, customer opted in → Class C reminder.
   Stop when an order is placed.

Tests: review eligibility; moderation; back-in-stock fires once; abandoned cart respects opt-in and
quiet hours.
```

---

## P39 — Analytics Events & Marketing Feeds

**Depends on:** P38 · **Docs:** PRD §3.17, §9; architechture.md §14

```text
Implement analytics and feeds (modules: analytics, catalog).

1. Server-side event pipeline: the outbox → analytics queue → providers: PostHog (capture API),
   GA4 Measurement Protocol, Meta Conversions API (hashed phone/email per Meta spec). Every provider
   has a mock and an env switch. Events: product_view (tier), add_to_cart (client — just provide
   the endpoint POST /api/v1/analytics/events for whitelisted client events with consent flag),
   checkout_started, order_placed, payment_succeeded, payment_failed, verify_lookup, qr_scan,
   rma_submitted, rto, preorder_milestone. Respect consent: events from clients without analytics
   consent are dropped except strictly-necessary server KPIs (stored internally without third-party
   forwarding — record the decision).
2. analytics_events table (internal copy for KPIs, monthly partitions, 13-month retention).
3. Feeds: hourly job builds the Google Merchant XML (RSS 2.0 g: namespace: id, title, description,
   link, image_link, price "1234.00 BDT", availability, brand, gtin, condition new,
   custom_label_0 = tier) and the Meta catalog CSV from PUBLISHED products → upload to R2 → served
   at GET /feeds/google.xml and GET /feeds/meta.csv (route handlers proxying/redirecting to the
   cached object, Cache-Control 1h).
4. Sitemap data endpoint for later UI: GET /api/v1/seo/sitemap-entries (product slugs, categories,
   updated_at, bn/en alternates).

Tests: the feed validates against a schema snapshot; the Meta CAPI payload hashes PII correctly;
consent filtering.
```

---

# STAGE 15 — ADMIN, SECURITY & COMPLIANCE

## P40 — Staff Admin, Audit Trail, Settings, Retention & Data Protection

**Depends on:** P39 · **Docs:** PRD §3.9, §3.18; architechture.md §15.2, §17.5, §18; api-spec §16.2

```text
Implement admin & compliance tools (modules: identity, audit, settings).

1. Staff management (SUPER_ADMIN): GET/POST /api/v1/admin/staff, PUT /:id (roles, status),
   POST /:id/reset-password (one-time password, must_change_password), POST /:id/reset-totp,
   POST /:id/sessions/revoke (from P07). Prevent removing the last SUPER_ADMIN.
2. Audit trail: GET /api/v1/admin/security/audit-trail (filters: staff, action, entity, date) and
   GET /api/v1/admin/security/audit-trail/verify?from=&to= → verifies the hash chain (api-spec §16.2).
   Nightly job 04:00 exports the day's audit rows + final hash as JSONL to the audit bucket with
   Object Lock (compliance mode, retention from settings; MinIO in dev supports object lock when the
   bucket is created with it).
3. Settings admin: GET/PUT /api/v1/admin/settings/:key (SUPER_ADMIN; Zod-validated; audit before/after).
4. Customer support tools (CUSTOMER_SUPPORT): GET /api/v1/admin/customers?phone= (FULL PII
   serializer → audit), customer detail with orders/claims/credit, ownership confirmation for
   dormant numbers (confirm or split/freeze — P06), COD block override (P29), support_tasks queue
   (GET/assign/complete).
5. Data protection: POST /api/v1/admin/customers/:id/anonymize (SUPER_ADMIN, on a deletion
   request): replace name/email/addresses with placeholders, hash the phone, keep orders/invoices/
   ledger intact (legal retention, default 6 years — TODO-CONFIRM), revoke sessions, status
   ANONYMIZED. Customer self-request endpoint POST /api/v1/customer/deletion-request → support task.
6. Retention jobs (daily 05:00, P31 extended): RMA media 180d after closure; QC photos warranty +
   1 year; seal verification partitions 12 months (P27); analytics 13 months; notification_logs
   12 months; sessions expired > 30 days purged.
7. Queue admin: mount bull-board under /admin/queues protected by a SUPER_ADMIN staff session
   (queues.admin); dead-letter list/retry endpoints (P04).
8. Security hardening: security headers in middleware/next.config (HSTS, CSP for API responses,
   X-Content-Type-Options, Referrer-Policy, frame-ancestors none), request body size limits per
   route, CORS (deny by default; allow-list from env for future native apps), Zod-stripped unknown
   keys, SQL only through Drizzle/parameterized queries, no stack traces in production errors.
9. Runner device policy: staff sessions on runner phones expire after 12h (already) — verify that
   revoked-device offline data is quarantined (P25) and add a manager review endpoint
   GET/POST /api/v1/admin/sourcing/quarantine/:id/(accept|reject).

Tests: last-admin protection; the audit verify endpoint detects tampering; anonymization keeps the
ledger balanced and orders queryable; header presence; bull-board blocked for non-admins.
```

---

# STAGE 16 — QUALITY & DELIVERY

## P41 — Seed Data & Dev Fixtures

**Depends on:** P40

```text
Create pnpm db:seed (idempotent) for local/staging:
- Settings defaults, ledger chart of accounts, locations, geo data, notification templates.
- Staff: one per role (password + TOTP secret printed for dev only), plus a SUPER_ADMIN.
- Categories (all six from PRD §3.0) with spec templates; brands (UGREEN, Baseus, Anker, Aqara,
  UNI-T, HIKMICRO, 70mai, OEM Nawabpur); ~40 products across tiers and fulfillment types with
  Bangla titles; comparison groups pairing Authentic vs Budget Smart (e.g. 65W GaN chargers,
  100W cables, earbuds); pre-order products (HIKMICRO PocketE, UNI-T clamp meter, smart door lock,
  70mai jump starter, power station) with BTRC states.
- Suppliers in each market with supplier_stock; physical stock in godown/showroom for some SKUs.
- Customers: a first-time buyer, a verified repeat buyer, a COD-blocked buyer (2 RTOs), a dormant
  (13 months) account.
- A coupon draft + an active coupon; sample orders in several states, seals, one RMA claim, one
  courier settlement CSV fixture in src/db/seed/fixtures/.
Also: pnpm dev:scenario <name> scripts that simulate end-to-end flows through the services
(cod-first-time, preorder-full-cycle, rto, rma-doa, walk-in) and print the resulting trial balance.
```

---

## P42 — OpenAPI Spec & API Documentation

**Depends on:** P41

```text
1. Register every route's Zod schemas (request, responses, error envelope, auth requirement,
   idempotency header, rate limits) with zod-to-openapi; pnpm openapi:generate writes
   docs/openapi.json (OpenAPI 3.1).
2. Serve GET /api/v1/openapi.json and a Scalar or Swagger UI page at /api/docs (dev/staging only;
   SUPER_ADMIN-protected in production).
3. Generate docs/API.md: a table of all endpoints (method, path, auth/permission, idempotent?,
   description) and a diff section against api-spec.md listing every intentional deviation with the
   reason (from DECISIONS.md).
4. A CI check fails if any route handler is missing from the OpenAPI registry.
```

---

## P43 — Integration & End-to-End API Test Suites

**Depends on:** P42 · **Docs:** architechture.md §19

```text
Make sure these suites exist and pass (Vitest + Testcontainers; API-level E2E with supertest-style
calls against the Next.js route handlers or a running dev server in CI):

Unit: money, VAT, allocation, deposit table, coupon rules, COD eligibility, state machines, every
ledger posting rule (property-based), seal generator/normalizer, quiet hours, margin check,
refundable amounts.

Integration (DB-level):
- Reservation race for the last unit (parallel checkouts).
- Commit-vs-expiry race.
- IPN replay idempotency (IPN + success + reconciliation concurrently).
- Runner sync duplicates / conflicts / quarantine.
- Append-only triggers on all six append-only tables.
- Unbalanced journal rejection; duplicate posting prevention.
- Gapless Mushak serials under concurrency.
- Audit hash-chain integrity.

E2E API flows (with mock providers):
1. Regular COD checkout for a repeat buyer → sourcing → QC → seal → pack → courier → delivered →
   settlement → trial balance check.
2. First-time buyer advance fee (৳80) via SSLCommerz mock → COD remainder.
3. Pre-order deposit → milestones → QC → balance online → delivery; plus the Day-8 forfeiture variant.
4. /verify lookup + rate limit + clone alert.
5. RMA with video upload (multipart) → adjudicate → reverse pickup → inspect → refund.
6. POS pickup with PIN + walk-in sale + drawer close.
7. RTO flow → COD block after the 2nd RTO.
Report coverage (target ≥ 85% lines for src/modules/**/service.ts and pricing/ledger ≥ 95%).
```

---

## P44 — Production Docker, CI/CD, Monitoring & Backups

**Depends on:** P43 · **Docs:** architechture.md §17

```text
1. docker/Dockerfile.web (multi-stage, Next standalone output, non-root user) and
   docker/Dockerfile.worker (same codebase, runs dist worker via tsx-compiled or esbuild bundle).
2. docker/compose.prod.yml: caddy (TLS, reverse proxy to web ×2, security headers), web ×2, worker ×1,
   redis (AOF, password), meilisearch (master key); Postgres is external/managed (DATABASE_URL).
   Healthchecks for every service.
3. Multi-replica requirements: a Redis-backed Next.js cacheHandler; the same
   NEXT_SERVER_ACTIONS_ENCRYPTION_KEY and deployment ID on all replicas (document it).
4. GitHub Actions: lint → typecheck → unit → integration (Testcontainers) → build images → push GHCR
   → deploy to staging (ssh + compose pull/up with a separate migration step, expand/contract
   migrations) → E2E against staging → manual approval → production rolling restart.
5. Migrations run as a one-off container before the rolling restart; never automatically in web boot.
6. Monitoring: Sentry in web + worker (release tagging), Better Stack heartbeats for every scheduled
   job (list all jobs from architechture.md §16 and confirm each is registered), uptime checks for
   /api/v1/health, structured logs.
7. Backups: document the managed Postgres PITR + daily backups (30 days); add a weekly logical dump
   job (pg_dump → R2) and docs/RUNBOOK.md: restore drill steps, RPO ≤ 5 min / RTO ≤ 2 h procedures,
   secret rotation, incident checklist (payment mismatch, courier outage, clone alert).
8. Secrets via the deployment environment (Docker secrets or Doppler); verify no secret is in the repo
   (gitleaks in CI) and add dependency scanning (npm audit / Dependabot).
```

---

## P45 — Final Traceability Audit Against the Docs

**Depends on:** P44

```text
Perform a full audit and produce docs/TRACEABILITY.md:
1. A table mapping EVERY PRD v1.4 requirement (§3.1–§3.18, Flows 1–13, §6 NFRs, §10 risks) to the
   implementing module/files, endpoints, jobs and tests. Mark each as DONE / PARTIAL / DEFERRED
   (with a reason).
2. Verify every background job in architechture.md §16 exists with the right schedule (Asia/Dhaka)
   and a heartbeat.
3. Verify every endpoint in api-spec.md exists (or is documented as an intentional deviation).
4. Verify the RBAC matrix (PRD §3.9) against the permission map with an automated test.
5. Verify the Phase 0 checklist items (architechture.md §20) are listed as TODO-VERIFY with the code
   locations to update once confirmed (courier APIs/CSV formats, SSLCommerz refund/settlement
   formats, SMS sender ID, WhatsApp templates, printer label size, VAT/Mushak rules, retention period).
6. Run the full test suite and seed scenarios; attach the final trial balance output.
7. List the remaining risks and recommended next steps (UI build order: storefront → /verify →
   customer portal → admin → POS → runner PWA).
```

---

## Appendix A — Key Business Values (quick reference for every prompt)

| Rule | Value | Source |
| :--- | :--- | :--- |
| Pre-order deposit | 20% of first ৳50,000 + 10% above, per unit, rounded **up** to ৳10, ≤ unit price | PRD §3.3.2 |
| Pre-order balance via COD | Only if balance ≤ ৳30,000 (configurable) and not COD-blocked | PRD §3.3.2 |
| Pre-order cancel | 100% refund before `SOURCED_IN_TRANSIT`; non-refundable after | PRD §3.3.5 |
| Pre-order delay | ETA + 7 days → cancel 100% (24h window) or keep + ৳1,000 credit | PRD §3.3.5 |
| FX repricing | Devaluation > 8% → 48h approval ticket; only the balance changes | PRD §3.3.5 |
| Balance default | Reminders Day 1/4/7 (10:00); Day 8 forfeiture → Flash Deal | PRD §3.3.5 |
| Batch threshold | N pre-orders not reached in 30 days → refund / expedited fee | PRD §3.3.5 |
| Delivery fee | ৳80 inside Dhaka / ৳150 nationwide up to 1 kg + per-kg surcharge | PRD §3.7 |
| COD tiers | delivered ≥ 1 & RTO = 0 → full COD; RTO ≥ 2 → blocked; else advance base fee | PRD §3.6.2 |
| Reservation | 10 min, physical stock only | PRD §3.6.3 |
| Unpaid auto-cancel | 24 h | PRD §3.12 |
| Spot buffer / margin | 5–7% (default 5%) / ≥ 15% on list price excl. VAT | PRD §3.4.2 |
| Override escalation | Re-alert via WhatsApp/SMS after 5 min | PRD §3.4.2 |
| Runner receipt approval | > ৳2,000 without receipt needs SM approval | PRD §3.13.4 |
| OTP | 6 digits, 3 min, 3 attempts, 3 sends/10 min/phone, 20/h/IP | PRD §3.5 |
| Dormancy | 12 months → ownership confirmation | PRD §3.5 |
| Sessions | Customer 30-day sliding; staff 12 h + TOTP | arch §6.2 |
| `/verify` limits | 5/min/device, 60/min/IP → Turnstile; abuse → 15-min block | PRD §3.2.3 |
| Clone alert | ≥ 5 devices AND ≥ 2 districts in 24 h, or void-seal lookup (internal only) | PRD §3.2.3 |
| QC sampling | 5% of passes; audit within 2 h else escalate | PRD §3.2.4 |
| Pickup PIN | 6 digits, hashed, 7 days, lock after 5 wrong | PRD §3.7 |
| Unclaimed pickup | Reminders Day 3/6; unpaid cancel Day 8; prepaid hold 14 days | PRD §3.7 |
| Warranty start | Delivered / handover; fallback dispatch + 3 days (Dhaka) / + 5 days | PRD §3.8.7 |
| DOA | ≤ 48 h with unboxing video; replacement within 24 h | PRD §3.8.3 |
| Budget warranty | 7-day replacement | PRD §3.8.1 |
| RMA TAT | ≤ 72 h Dhaka / ≤ 5 business days nationwide | PRD §3.8.6 |
| RMA media | Photos ≤ 5 × 10 MB; video 1 × 300 MB, ≤ 3 min | PRD §3.8.8 |
| Refund approval | Support ≤ ৳1,000; Finance ≤ ৳20,000; Super Admin above | PRD §3.14.2 |
| Refund SLA | Initiated ≤ 24 h after approval; received ≤ 7 working days | PRD §3.14.4 |
| Goodwill credit | Expires in 12 months, not withdrawable; refund-credit never expires | PRD §3.14.6 |
| Supplier suspension | Defect rate > 3%; batch 3-of-5 failures → whole batch returned | PRD §1.3, §10 |
| Settlement aging | No unreconciled item older than 7 days | PRD §1.3 |
| Quiet hours | Class B/C only 08:00–22:00 Asia/Dhaka; Class A 24/7 | PRD §3.10 |
| Mushak 6.3 | Gapless serial per fiscal year (July–June) | PRD §3.6.4 |
| Retention | Ledger/invoices ≥ 6 yrs (TBC); RMA media 180 d; QC photos warranty + 1 yr; verify logs 12 mo | PRD §3.18 |

## Appendix B — Background Jobs Checklist (Asia/Dhaka)

| Job | Schedule | Prompt |
| :--- | :--- | :--- |
| Outbox relay | Continuous (1 s) | P04 |
| Reservation expiry | Every 1 min | P14 |
| SSLCommerz reconciliation | Every 5 min | P21 |
| Cloned seal detection | Every 5 min | P27 |
| QC sampling escalation | Every 5 min | P26 |
| Courier booking retries | On event, 1m/5m/15m/30m | P28 |
| Courier status polling fallback | Every 30 min | P29 |
| Gateway refund status poll | Every 30 min | P33 |
| Unpaid order auto-cancel | Every 15 min | P21 |
| Refund SLA monitor | Hourly | P33 |
| Abandoned cart reminders | Hourly | P38 |
| Feeds generation | Hourly | P39 |
| Pre-order Day-8 forfeiture | Daily 00:05 | P23 |
| Store credit expiry | Daily 00:15 | P16 |
| Pre-order batch threshold | Daily 01:00 | P23 |
| Warranty start fallback | Daily 02:00 | P29 |
| Seal warranty expiry | Daily 02:30 | P27 |
| `rto_count_12m` recompute | Daily 03:00 | P29 |
| Inventory vs movements check | Daily 03:30 | P14 |
| Audit log export to R2 | Daily 04:00 | P40 |
| Idempotency key cleanup | Daily 04:30 | P04 |
| Media / data retention cleanup | Daily 05:00 | P31, P40 |
| Supplier stock staleness | Daily 08:00 | P13 |
| Pre-order delay detection | Daily 09:00 | P23 |
| COD settlement aging / MISSING | Daily 09:00 | P34 |
| Pickup expiry & reminders | Daily 09:30 | P30 |
| Pre-order balance reminders | Daily 10:00 | P23 |
| Verification partition maintenance | Monthly (25th) | P27 |
| Weekly logical DB dump | Weekly | P44 |

## Appendix C — Resolved Document Conflicts

| Topic | Conflict | Decision |
| :--- | :--- | :--- |
| Database | database*.md use MongoDB/Mongoose | PostgreSQL 16 + Drizzle (PRD §12, arch §21) |
| Data shape | Embedded arrays (items, sessions, scans, journal lines) | Normalized tables |
| App structure | — | Next.js 15 monolith (API route handlers) + worker; UI later |
| Endpoint paths | api-spec vs arch differ | api-spec is the base; arch-only endpoints added (batch runner sync, `/verify?q=`, SSE, feeds, media uploads) |
| Clone warning | api-spec shows the clone warning publicly | Internal-only alert (PRD §3.2.3) |
| COD-blocked checkout | api-spec says "advance fee required" | COD hidden, online only (PRD §3.6.2) |
| Seal void reasons | database.md: DAMAGED_LABEL, FAILED_QC_RETEST | PRINTER_JAM, RIBBON_TEAR, STICKER_DAMAGED (PRD) |
| Locations | database.md: 3 codes | 6 locations (PRD §3.11) |
| Product publish | `is_published` boolean | Full lifecycle status (PRD §3.15) |
| Staff identity | Staff stored with customers in one collection | Separate `staff` + `staff_roles` (multi-role, PRD §3.9) |
| Percent storage | Floats (`vat_rate_pct`) | Integer basis points |
| Override trigger | api-spec "> 7%" | Per-SKU buffer (5–7%) AND margin ≥ 15% (PRD §3.4.2) |
| RMA notification SLA | "1 business hour" vs 2 h | Within 1 hour (PRD §3.10, §13) |
