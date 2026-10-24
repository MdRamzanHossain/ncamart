# AGENT.MD — NCAMart Engineering & AI Agent Operating Instructions

> **Project:** NCAMart (`ncamart.com`)  
> **Domain:** High-Trust Operations-Heavy Tech Accessories E-Commerce  
> **Location / Market:** Nawabpur, Dhaka, Bangladesh (B2C & B2B)  
> **Execution Strategy:** **Backend-First** (Phase 1 + Phase 1.5). Full domain logic, normalized database, REST APIs, BullMQ worker, and integration tests before storefront/admin UI.  
> **Primary Audience for this Document:** Any Autonomous AI Agent, Pair Programmer, or Software Engineer building or maintaining this codebase.

---

## 1. Project Mission & Identity

NCAMart is a specialized e-commerce platform built to solve the high-counterfeit, low-trust reality of Bangladesh's largest electronics & electrical market: **Nawabpur, Dhaka**.

### Core Pillars
1. **Anti-Counterfeit Holographic Seals (`NCA-XXXX-XXXX`):** Crockford Base32 tamper-evident scratch seals verified via `/verify` portal, backed by an append-only audit trail and automated clone detection.
2. **Tiered Transparency:** Every SKU is explicitly categorized as **`AUTHENTIC`** (OEM verified, full warranty) or **`BUDGET_SMART`** (tested value tier, clear disclosure).
3. **Rigorous Quality Control:** 3-point / non-invasive pre-dispatch physical inspection with photo evidence and seal assignment before dispatch.
4. **Offline Runner Sourcing:** Nawabpur runner network using a dedicated PWA with offline task syncing, real-time spot price checks against godown float limits, and physical PII stripping.
5. **Showroom POS Counter:** Instant walk-in sales and online order pickup verification using secure 4-digit pickup PINs.
6. **Financial Integrity:** Strict double-entry accounting ledger with **integer paisa** precision (`1 BDT = 100 paisa`), zero client financial trust, and append-only database triggers.

---

## 2. Documentation Hierarchy & Precedence Rules

When reading repository documentation or when specifications conflict, **strictly follow this precedence order**:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. PRD.md (v1.4)                                            │  Highest Authority for Business Rules,
│    → Business rules, states, values, RBAC, SLAs             │  Financial Formulas & Operational Logic
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 2. architechture.md (v1.1)                                  │  Authoritative for Technical Architecture,
│    → Stack, module boundaries, algorithms, jobs, ledger     │  Postgres Normalization & System Patterns
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 3. api-spec.md (v2.0)                                       │  Authoritative for Endpoint Paths, HTTP
│    → Routes, request/response DTOs, status codes            │  Methods, Query Params & Error Shapes
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 4. database.md / database-schema.md                         │  Field Checklist Reference ONLY.
│    → Field-level dictionary (DISREGARD MongoDB references)  │  MUST map to normalized PostgreSQL 16.
└─────────────────────────────────────────────────────────────┘
```

### Precedence Protocols
- **MongoDB vs. PostgreSQL:** `database.md` and `database-schema.md` contain legacy MongoDB/Mongoose syntax. **Disregard all Mongoose schemas and embedded subdocuments.** All data must be normalized into relational PostgreSQL 16 tables with Drizzle ORM (separate tables for items, journal lines, status history, addresses, etc.).
- **Seal Void Reasons:** `PRD.md` wins (`PRINTER_JAM`, `RIBBON_TEAR`, `STICKER_DAMAGED`).
- **Conflict Resolution Log:** When resolving any discrepancy between documents, document the decision in `docs/DECISIONS.md` using the format:
  `[Date] | [Topic] | [Selected Choice] | [Reason & Precedence Level]`

---

## 3. Technology Stack (Strict & Non-Negotiable)

Do not substitute or introduce alternative libraries without explicit developer consent.

| Component | Technology | Configuration & Usage |
| :--- | :--- | :--- |
| **Runtime & Language** | **Node.js 22 LTS**, **TypeScript** | Strict mode: `"strict": true`, `"noUncheckedIndexedAccess": true`. Package manager: `pnpm`. |
| **Framework** | **Next.js 15 (App Router)** | Standalone mode (`output: "standalone"`). REST API route handlers located under `src/app/api/v1/**`. |
| **Database** | **PostgreSQL 16** | Normalized relational schema. Managed via **Drizzle ORM** (`drizzle-orm`) and `drizzle-kit` migrations. Raw SQL migrations for triggers, partitions, and functions. |
| **Cache & In-Memory** | **Redis 7 (AOF enabled)** | Client: `ioredis`. Used for rate limiting, OTP storage, session management, SSE pub/sub, and BullMQ queues. |
| **Job Queue & Worker** | **BullMQ 5+** | Dedicated worker entrypoint (`src/worker/index.ts`). Processes transactional outbox events, scheduled jobs, and quiet-hour delayed tasks. |
| **Search Engine** | **Meilisearch** | Bangla, English, and Banglish tokenization with typo tolerance. Synced strictly via transactional outbox events. |
| **Object Storage** | **Cloudflare R2** / MinIO (local) | S3-compatible API (`@aws-sdk/client-s3`). Presigned URLs for media, RMA video proofs, and thermal print labels. |
| **Validation & Schema** | **Zod 3+** | All API inputs, query params, headers, and outbox payloads must be validated with Zod. |
| **OpenAPI / Swagger** | **@asteasolutions/zod-to-openapi** | Auto-generated OpenAPI 3.1 specification directly from Zod route schemas. |
| **Auth & Security** | **argon2 (argon2id)**, **otplib** | Staff password hashing via `argon2id`. Staff 2FA via TOTP with AES-256-GCM encryption for secrets at rest. Session cookie `nca_sid` or Bearer JWT. |
| **Testing** | **Vitest**, **Testcontainers** | Vitest for unit tests; `@testcontainers/postgresql` and `@testcontainers/redis` for zero-mock integration testing. |
| **Logging & Monitoring** | **Pino**, **Sentry SDK** | Structured JSON logging with `x-request-id` tracing. Sentry error capture (graceful no-op when DSN is absent). |

---

## 4. Inviolable Architectural Laws

Every AI agent working on this codebase must strictly adhere to these 15 core architectural rules:

### 1. Integer Paisa for All Financial Fields
- **Never use floating point numbers for currency.**
- All money columns must end in `_paisa` and use PostgreSQL `bigint` mapped to JavaScript numbers (`bigint({ mode: 'number' })`).
- `1 BDT = 100 paisa` (e.g., 550.50 BDT is stored as `55050`).
- Rounding rule: Standard half-up integer rounding applied only at the final multiplication step.

### 2. Basis Points for Rates & Percentages
- Store all percentages and rates as integer basis points ending in `_bps` (1% = 100 bps, 7.5% VAT = 750 bps, 5% spot buffer = 500 bps).

### 3. Zero Client-Side Financial Trust
- The client/frontend never dictates prices, discounts, delivery fees, deposit amounts, or taxes.
- The server re-calculates all line items, promotional discounts, coupon applicability, shipping surcharges, and total amounts directly from the database during checkout and payment initiation.

### 4. Single-Transaction Atomicity
- When a business state transition occurs, the following must happen in **one single database transaction**:
  1. Main entity state update (e.g., `orders`).
  2. Status history log row (e.g., `order_status_history`).
  3. Stock movement or reservation record (e.g., `stock_movements`).
  4. Double-entry ledger journal entry & lines (when financial value moves).
  5. Transactional outbox event insertion (`outbox_events`).

### 5. Transactional Outbox Pattern
- **Never execute external third-party API calls or long-running tasks inside a database transaction.**
- External operations (SSLCommerz, Steadfast/Pathao couriers, SMS gateways, WhatsApp Cloud API, Resend email, Meilisearch indexing) must be recorded as rows in `outbox_events` within the transaction.
- The BullMQ worker (`src/worker/index.ts`) polls or consumes outbox events, executes with exponential backoff retries, and records execution status.

### 6. Append-Only Financial & Audit Tables
- The following tables are strictly append-only:
  - `journal_entries` & `journal_lines`
  - `stock_movements`
  - `seal_events`
  - `order_status_history`
  - `audit_logs`
- Each of these tables must have a PostgreSQL trigger preventing `UPDATE` or `DELETE` operations. Corrections to ledger or inventory must be executed via compensatory reversal records.

### 7. Strict Module Isolation
- Module layout: `src/modules/<module-name>/`.
- A module may only export its public API via:
  - `service.ts` (business use cases and operations)
  - `events.ts` (outbox event definitions and payload types)
- **A module must never import another module's `repo.ts`, `schema.ts`, or internal helpers directly.**
- Enforced via ESLint rule (`no-restricted-imports`).

### 8. Strict State Machine Transitions
- Domain entities (`orders`, `payments`, `preorders`, `runner_tasks`, `seals`, `qc_inspections`, `rma_claims`, `refunds`, `settlements`) must strictly transition according to predefined state machines.
- Any attempt to perform an illegal state transition must throw a domain exception resulting in HTTP `409 Conflict` (`ERR_ILLEGAL_TRANSITION`).

### 9. Idempotency on Critical Endpoints
- The `Idempotency-Key` HTTP header is mandatory on all mutation endpoints involving funds, orders, or state changes:
  - `POST /api/v1/checkout`
  - `POST /api/v1/payments/initiate`
  - `POST /api/v1/orders/:id/cancel`
  - `POST /api/v1/refunds`
  - `POST /api/v1/pos/sales`
  - `POST /api/v1/runner/sync`
- Keys are cached in Redis and persisted in `idempotency_keys` with a 24-hour TTL. Duplicate requests with identical payloads return the cached response; identical keys with different payloads return `422 ERR_IDEMPOTENCY_MISMATCH`.

### 10. Privacy & Customer PII Redaction
- **Field Runner Protection:** DTOs returned to runner endpoints (`/api/v1/runner/**`) must physically exclude customer names, phone numbers, and full delivery addresses. Runners only receive SKU codes, quantities, target godowns, and supplier counter identifiers.
- **Audit Logs on PII Access:** Any staff read of unmasked customer PII (phone number, full address, email) must generate an asynchronous `audit_logs` entry.

### 11. Strict Timezone & Schedule Conventions
- All database timestamps must use `timestamptz` and be stored in UTC (`NOW() AT TIME ZONE 'UTC'`).
- Business day cutoffs, runner shift windows, quiet hours, and daily settlement reports are evaluated in `Asia/Dhaka` (UTC+6, no DST).

### 12. Standardized Bangladeshi Phone Number Formatting
- Validate all mobile numbers using the strict regex:
  `^(?:\+8801|01)[3-9]\d{8}$`
- Always normalize stored and processed numbers to E.164 format:
  `+8801XXXXXXXXX` (13 characters).

### 13. Crockford Base32 Anti-Counterfeit Seal Identifiers
- Seal public codes must adhere to Crockford Base32 formatting (omitting confusing characters `I`, `L`, `O`, `U`):
  - Format: `NCA-XXXX-XXXX`
  - Regex: `^NCA-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$`

### 14. Standardized API Response & Error Envelopes
- **Success (Resource):**
  ```json
  {
    "data": { ... }
  }
  ```
- **Success (Paginated Collection):**
  ```json
  {
    "items": [ ... ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total_count": 142,
      "total_pages": 8
    }
  }
  ```
- **Error (All 4xx / 5xx responses):**
  ```json
  {
    "error": {
      "code": "ERR_INSUFFICIENT_STOCK",
      "message": "Only 2 units available in GODOWN_NAWABPUR",
      "status": 409,
      "details": { "sku_id": "...", "requested": 5, "available": 2 },
      "timestamp": "2026-10-21T15:00:00.000Z"
    }
  }
  ```

### 15. Mock Implementations for All External Providers
- Every third-party dependency must define a TypeScript interface and provide both:
  1. A production adapter (e.g., SSLCommerz, Pathao, Steadfast, ElitBuzz SMS, Cloudflare R2).
  2. A deterministic mock adapter for offline local development and test environments.
- Providers are selected via environment variables (e.g., `SMS_PROVIDER=mock`, `PAYMENT_GATEWAY_PROVIDER=mock`).

---

## 5. Domain Modules & Directory Structure

The repository follows a clean modular architecture within Next.js 15:

```
ncamart/
├── docs/
│   ├── PROGRESS.md             # Execution log of implemented prompts & tests
│   └── DECISIONS.md            # Architecture & specification conflict log
├── src/
│   ├── app/
│   │   └── api/
│   │       └── v1/             # Next.js Route Handlers (REST controllers)
│   │           ├── auth/
│   │           ├── catalog/
│   │           ├── cart/
│   │           ├── checkout/
│   │           ├── orders/
│   │           ├── preorder/
│   │           ├── payments/
│   │           ├── verify/     # Public seal verification
│   │           ├── runner/     # Offline runner sync & task endpoints
│   │           ├── qc/         # QC station inspection endpoints
│   │           ├── pos/        # Showroom POS & pickup verification
│   │           ├── rma/        # Returns & warranty claims
│   │           ├── logistics/  # Courier webhooks & dispatch
│   │           └── admin/      # Management & audit routes
│   ├── modules/                # Core domain business logic
│   │   ├── identity/           # Customers, staff, OTP, sessions, TOTP, RBAC
│   │   ├── catalog/            # Categories, brands, products, SKUs, tiers
│   │   ├── inventory/          # Godown stock, virtual stock, reservations, movements
│   │   ├── pricing/            # Price calculation, tier discounts, wholesale slabs
│   │   ├── promotions/         # Coupons, vouchers, store credits, cart rules
│   │   ├── ledger/             # Double-entry accounting, journal lines, COA
│   │   ├── orders/             # Order state machine, line items, address validation
│   │   ├── preorder/           # Milestones, deposits, spot repricing, forfeiture
│   │   ├── payments/           # SSLCommerz, COD, bKash, refund transactions
│   │   ├── sourcing/           # Runner tasks, float tracking, spot purchases
│   │   ├── trust/              # Holographic seals, printing, clone detection
│   │   ├── qc/                 # 3-point inspection, checklists, defect quarantine
│   │   ├── logistics/          # Shipping zones, courier adapters, package labels
│   │   ├── pos/                # Cash drawer shifts, PIN verification, walk-ins
│   │   ├── rma/                # Claims, inspection, reverse logistics, replacements
│   │   ├── finance/            # COD reconciliations, courier settlement, payout reports
│   │   ├── notifications/      # Class A/B/C notification router, SMS, email, SSE
│   │   ├── search/             # Meilisearch client, index management, document sync
│   │   ├── analytics/          # Sales aggregates, cohort tracking, product performance
│   │   └── audit/              # Immutable audit logging, PII access tracking
│   │       └── [module]/
│   │           ├── schema.ts   # Drizzle table definitions & relations
│   │           ├── repo.ts     # Internal data access & queries
│   │           ├── service.ts  # Public module service (exported)
│   │           ├── events.ts   # Outbox event schemas & types (exported)
│   │           ├── policies.ts # Permission rules
│   │           └── *.test.ts   # Unit & integration tests
│   ├── worker/                 # Standalone BullMQ worker process
│   │   ├── index.ts            # Worker launcher & shutdown handlers
│   │   ├── outbox-relay.ts     # Outbox table consumer -> BullMQ dispatcher
│   │   └── jobs/               # Job handlers (sms, emails, courier sync, search index)
│   ├── lib/                    # Shared core infrastructure
│   │   ├── db/                 # Drizzle instance, pool client, migrations
│   │   ├── redis/              # Redis client & connection management
│   │   ├── errors/             # Standard AppError classes & error codes
│   │   ├── route-handler/      # withRoute wrapper for auth, validation, logging
│   │   ├── money/              # Paisa math, rounding, and currency formatting
│   │   ├── security/           # Crypto helpers (AES-256-GCM, Crockford, Argon2)
│   │   └── env.ts              # Zod-validated environment configuration
│   └── tests/                  # Test helpers, testcontainers fixtures & seeds
```

---

## 6. Core Domain Workflows & Canonical State Machines

### 1. Order State Lifecycle (`PRD.md §3.12`)
```mermaid
stateDiagram-v2
    [*] --> PENDING_PAYMENT: Online Checkout
    [*] --> CONFIRMED: COD / Walk-In / Deposit Paid
    PENDING_PAYMENT --> CONFIRMED: Payment Received
    PENDING_PAYMENT --> CANCELLED: Expired / Customer Cancelled
    CONFIRMED --> SOURCING: Out of Stock / Pre-Order
    CONFIRMED --> IN_QC: Stock Available in Godown
    SOURCING --> IN_QC: Runner Acquired & Received in Godown
    IN_QC --> QC_FAILED: Defects Found
    QC_FAILED --> SOURCING: Re-sourcing Requested
    QC_FAILED --> CANCELLED: Unrecoverable Defect / Refund
    IN_QC --> QC_PASSED: Seal Attached & Verified
    QC_PASSED --> PACKED: Packing Slip & Label Affixed
    PACKED --> HANDED_TO_COURIER: Courier Manifest Signed
    PACKED --> READY_FOR_PICKUP: Showroom Pickup Order
    HANDED_TO_COURIER --> OUT_FOR_DELIVERY: In Transit
    READY_FOR_PICKUP --> DELIVERED: Handover via 4-Digit PIN
    OUT_FOR_DELIVERY --> DELIVERED: Customer Accepted & Paid COD
    OUT_FOR_DELIVERY --> RTO_IN_TRANSIT: Customer Refused / Unavailable
    RTO_IN_TRANSIT --> RETURNED_TO_GODOWN: Stock Returned & Restocked
    DELIVERED --> [*]
    RETURNED_TO_GODOWN --> [*]
    CANCELLED --> [*]
```

### 2. Holographic Anti-Counterfeit Seal Lifecycle
- **Statuses:** `GENERATED` → `PRINTED` → `ACTIVE` → `CLAIMED` | `EXPIRED` | `VOID_PRINT_ERROR`.
- **Void Print Reasons:** `PRINTER_JAM`, `RIBBON_TEAR`, `STICKER_DAMAGED`.
- **Clone Detection Algorithm:**
  - If a seal code is scanned via `/verify` from > 3 distinct Class C IP subnets or distinct user agents within 10 minutes, trigger `SEAL_CLONE_SUSPECTED`.
  - Instantly flag the seal in the database, alert the Super Admin and customer support, and display an authenticity warning banner on the verification page.

### 3. Double-Entry Accounting Ledger Model
- Every monetary event writes one `journal_entries` header and minimum two balanced `journal_lines` (`SUM(debit_paisa) == SUM(credit_paisa)`).
- **Core Accounts Chart:**
  - `1010` — Cash at Showroom Till (Asset)
  - `1020` — Bank / SSLCommerz Settlement Account (Asset)
  - `1030` — Courier COD Receivables (Asset)
  - `1040` — Runner Float Advance (Asset)
  - `1200` — Inventory Asset at Cost (Asset)
  - `2010` — Accounts Payable / Supplier (Liability)
  - `2020` — Customer Wallet / Store Credit (Liability)
  - `2030` — Customer Pre-Order Deposits (Liability)
  - `2040` — VAT Payable (Liability)
  - `4010` — Retail Sales Revenue (Revenue)
  - `4020` — Delivery Fee Income (Revenue)
  - `5010` — Cost of Goods Sold - COGS (Expense)
  - `5020` — Sourcing Runner Commission (Expense)
  - `5030` — Courier Delivery Charge (Expense)
  - `5040` — Payment Gateway Fee (Expense)

### 4. Runner Sourcing & Spot Purchasing
- Sourcing Managers allocate a daily cash float to runners (`runner_floats` table).
- Tasks are dispatched to the runner PWA (`runner_tasks`).
- If supplier spot price exceeds the estimated catalog cost:
  - Variance ≤ 5% (`spot_buffer_bps`): Runner can approve immediately.
  - Variance > 5%: Runner must request manager override via the system.
- Offline synchronization: Runner PWA queues purchases in IndexedDB and commits via `POST /api/v1/runner/sync` with an `Idempotency-Key`.

---

## 7. Role-Based Access Control (RBAC) Matrix

Staff users have one or more distinct assigned roles:

| Role | Permissions & Boundaries |
| :--- | :--- |
| **`FIELD_RUNNER`** | View assigned sourcing tasks; submit purchase receipts and serial numbers; view current float balance. **ZERO access to customer PII (names, phone numbers, addresses).** |
| **`QC_TECHNICIAN`** | Access QC workstation; execute 3-point checklists; record pass/fail inspection photos; assign holographic seals. |
| **`GODOWN_MANAGER`** | Receive runner items into godown; execute inventory transfers; conduct cycle counts; approve wastage. |
| **`DISPATCH_STAFF`** | Print packing slips and shipping manifests; hand over packages to couriers; scan tracking numbers. |
| **`SHOWROOM_POS_STAFF`**| Process walk-in sales; accept cash/card/MFS; verify online pickup orders with 4-digit PIN; open/close cash drawers. |
| **`SOURCING_MANAGER`** | Create sourcing tasks; assign runners; approve spot price variances; disburse runner floats. |
| **`CATALOG_MANAGER`** | Manage brands, categories, products, and SKUs; set pricing and wholesale tier slabs; approve product drafts. |
| **`CUSTOMER_SUPPORT`** | Search customer orders; view masked customer info; initiate RMA tickets; issue customer store credits. Unmasking full PII requires audit logging. |
| **`FINANCE_OFFICER`** | Reconcile courier COD settlements; reconcile SSLCommerz payouts; view double-entry journal and balance sheets. |
| **`SUPER_ADMIN`** | System configuration, staff user management, role assignment, TOTP resets, raw audit log inspection, dead-letter queue re-triages. |

*Customers authenticate via a separate `customers` table and have zero access to `/admin/**`, `/pos/**`, or `/runner/**`.*

---

## 8. Engineering Standards for Code Quality

Whenever writing or modifying code in this repository, you must guarantee:

### 1. TypeScript Strictness
- No `any` types. Use `unknown` with Zod parsing or explicit type guards.
- No non-null assertions (`!`) unless immediately preceded by a verified runtime guard.
- All domain entity IDs are strongly typed (e.g., `BrandId`, `OrderId`, `SkuId` via branded types or strict strings).

### 2. Error Handling Standard
- Never return raw, unhandled 500 error stack traces to clients.
- Use structured application errors derived from `AppError`:
  ```ts
  throw new BusinessRuleError('ERR_ORDER_ALREADY_PAID', 'This order has already been settled', 409);
  ```
- All REST route handlers must be wrapped in `withRoute(async (req, ctx) => { ... })` which catches errors, logs with correlation IDs, and formats the standard JSON envelope.

### 3. Database Queries & Locking
- Use `SELECT ... FOR UPDATE` on inventory balance and reservation rows to prevent race conditions during high-volume checkout.
- Never write N+1 queries. Use Drizzle relational queries (`with: { ... }`) or bulk batch queries (`inArray(...)`).
- Always create database indexes on foreign keys, status enum columns, tenant/godown filters, and date ranges.

### 4. Unit & Integration Testing Requirements
- Every new module must include Vitest unit tests for pure domain logic (pricing calculations, state machine transitions, Crockford validation, basis point math).
- Integration tests must use Testcontainers with genuine PostgreSQL and Redis instances to verify transactional rollback, trigger constraints, and foreign key cascades.
- Run tests via `pnpm test`.

---

## 9. AI Agent Execution Protocol (Using `prompt.md`)

When an AI agent is instructed to implement features or stages from `prompt.md`:

```
┌────────────────────────────────────────────────────────┐
│ 1. Read Assigned Prompt in prompt.md (e.g. P18)        │
│    Check referenced sections in PRD.md & arch.md       │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 2. Check Existing Progress in docs/PROGRESS.md         │
│    Ensure all prerequisite prompts (dependencies) pass │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 3. Implement Code in Standard Sequence:                │
│    Schema → Migration → Repo → Service → Policies →    │
│    Route Handlers → Outbox Jobs → Tests                │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 4. Verification Gate (MUST PASS):                      │
│    pnpm lint && pnpm typecheck && pnpm test            │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 5. Update Documentation:                               │
│    - Record completed prompt in docs/PROGRESS.md       │
│    - Record architectural decisions in docs/DECISIONS.md│
│    - Add any newly introduced variables to .env.example│
└────────────────────────────────────────────────────────┘
```

### Self-Correction & Rules of Conduct
- **Do not skip ahead:** Only implement the specific scope defined in the current prompt. Leave marked comments (`// TODO(Pxx): ...`) for future phases.
- **Do not invent arbitrary business rules:** If a parameter is missing (e.g., courier weight surcharge), store it in a configurable `system_settings` table with a sensible default and mark with `// TODO-CONFIRM`.
- **Maintain Clean Git Diffs:** Never reformat unrelated files or delete existing comments and docstrings.
- **Commit Messages:** Follow Conventional Commits:  
  `feat(module): description [Pxx]` or `fix(module): description [Pxx]`.

---

## 10. Quick Reference: Environment Variables

Every external service must run with a mock adapter when API keys are omitted.

```bash
# Node & App
NODE_ENV="development"
PORT=3000
APP_URL="http://localhost:3000"
API_BASE_PATH="/api/v1"

# Database & Redis
DATABASE_URL="postgres://ncamart_user:ncamart_pass@localhost:5432/ncamart_dev"
REDIS_URL="redis://localhost:6379"

# Security & Secrets
SESSION_SECRET="min-32-chars-random-secret-for-cookies"
JWT_SECRET="min-32-chars-random-jwt-signing-key"
TOTP_ENCRYPTION_KEY="64-hex-chars-representing-32-bytes-aes-key"

# External Providers (Toggle 'mock' for local development)
PAYMENT_GATEWAY_PROVIDER="mock"      # 'mock' | 'sslcommerz'
SMS_PROVIDER="mock"                  # 'mock' | 'elitbuzz' | 'bulksmsbd'
COURIER_PROVIDER="mock"              # 'mock' | 'pathao' | 'steadfast'
STORAGE_PROVIDER="mock"              # 'mock' | 'cloudflare_r2' | 's3'

# Search Engine
MEILISEARCH_HOST="http://localhost:7700"
MEILISEARCH_MASTER_KEY="meili-dev-master-key"
```

---
*End of `agent.md`. Strictly follow these guidelines across every development session.*
