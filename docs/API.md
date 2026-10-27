# NCAMart REST API Specification & Endpoint Reference

**Document Version:** 2.0.0 (OpenAPI 3.1 Synchronized)  
**Last Generated:** 2026-10-27T06:26:43.849Z  
**Total Active Endpoints:** 266  
**Source of Truth:** `docs/openapi.json` (Generated via `pnpm openapi:generate`)  

## 1. Global Architectural Invariants

* **Monetary Representation:** Strictly integer paisa (`1 BDT = 100 Paisa`). Floating point values are strictly forbidden.
* **Percentages / Rates:** Strictly integer basis points (`1% = 100 bp`, e.g. 7.5% VAT = 750 bp).
* **Authentication Schemes:**
  * Customer & Staff Web Sessions: `nca_sid` HttpOnly, Secure, SameSite=Lax cookie.
  * Mobile / Headless / PWA Requests: HTTP Header `Authorization: Bearer <session_token>`.
  * Internal Worker & Webhook Ingestion: HTTP Header `X-Internal-Secret: <HMAC_SECRET>`.
* **Idempotency Standards:** All mutating POST/PUT endpoints support `Idempotency-Key` (UUIDv7) or `X-Client-Mutation-Id` for offline sync.
* **Uniform Error Envelope (RFC 7807):** All non-2xx responses conform to `{ error: { code, message, status, details?, timestamp } }`.

## 2. Active Endpoints Directory

### Admin & Governance (114 endpoints)

| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET   ` | `/api/v1/admin/catalog/brands` | STAFF (`catalog.read`) | - | - | Get Brands |
| `POST  ` | `/api/v1/admin/catalog/brands` | STAFF (`catalog.read`) | - | - | Create Brands |
| `DELETE` | `/api/v1/admin/catalog/brands/{id}` | STAFF (`catalog.read`) | - | - | Delete {id} |
| `GET   ` | `/api/v1/admin/catalog/brands/{id}` | STAFF (`catalog.read`) | - | - | Get By ID |
| `PUT   ` | `/api/v1/admin/catalog/brands/{id}` | STAFF (`catalog.read`) | - | - | Update {id} |
| `GET   ` | `/api/v1/admin/catalog/categories` | STAFF (`catalog.read`) | - | - | Get Categories |
| `POST  ` | `/api/v1/admin/catalog/categories` | STAFF (`catalog.read`) | - | - | Create Categories |
| `DELETE` | `/api/v1/admin/catalog/categories/{id}` | STAFF (`catalog.read`) | - | - | Delete {id} |
| `GET   ` | `/api/v1/admin/catalog/categories/{id}` | STAFF (`catalog.read`) | - | - | Get By ID |
| `PUT   ` | `/api/v1/admin/catalog/categories/{id}` | STAFF (`catalog.read`) | - | - | Update {id} |
| `GET   ` | `/api/v1/admin/catalog/categories/{id}/spec-fields` | STAFF (`catalog.read`) | - | - | Get Spec Fields |
| `POST  ` | `/api/v1/admin/catalog/categories/{id}/spec-fields` | STAFF (`catalog.read`) | - | - | Create Spec Fields |
| `GET   ` | `/api/v1/admin/catalog/comparison-groups` | STAFF (`catalog.read`) | - | - | Get Comparison Groups |
| `POST  ` | `/api/v1/admin/catalog/comparison-groups` | STAFF (`catalog.read`) | - | - | Create Comparison Groups |
| `DELETE` | `/api/v1/admin/catalog/comparison-groups/{id}` | STAFF (`catalog.read`) | - | - | Delete {id} |
| `GET   ` | `/api/v1/admin/catalog/comparison-groups/{id}` | STAFF (`catalog.read`) | - | - | Get By ID |
| `PUT   ` | `/api/v1/admin/catalog/comparison-groups/{id}` | STAFF (`catalog.read`) | - | - | Update {id} |
| `GET   ` | `/api/v1/admin/catalog/products` | STAFF (`catalog.read`) | - | - | Get Products |
| `POST  ` | `/api/v1/admin/catalog/products` | STAFF (`catalog.read`) | - | - | Create Products |
| `GET   ` | `/api/v1/admin/catalog/products/{id}` | STAFF (`catalog.read`) | - | - | Get By ID |
| `PUT   ` | `/api/v1/admin/catalog/products/{id}` | STAFF (`catalog.read`) | - | - | Update {id} |
| `POST  ` | `/api/v1/admin/catalog/products/{id}/approve` | STAFF (`catalog.publish`) | - | - | Approve Resource |
| `POST  ` | `/api/v1/admin/catalog/products/{id}/archive` | STAFF (`catalog.draft`) | - | - | Archive Catalog Product Resource |
| `POST  ` | `/api/v1/admin/catalog/products/{id}/media/{mediaId}/complete` | STAFF (`catalog.draft`) | - | - | Create Complete |
| `POST  ` | `/api/v1/admin/catalog/products/{id}/media/upload-url` | STAFF (`catalog.draft`) | - | - | Create Upload Url |
| `POST  ` | `/api/v1/admin/catalog/products/{id}/publish` | STAFF (`catalog.publish`) | - | - | Publish Catalog Product Resource |
| `POST  ` | `/api/v1/admin/catalog/products/{id}/reject` | STAFF (`catalog.publish`) | - | - | Reject Resource |
| `POST  ` | `/api/v1/admin/catalog/products/{id}/skus` | STAFF (`catalog.draft`) | - | - | Create Skus |
| `PUT   ` | `/api/v1/admin/catalog/products/{id}/skus/{skuId}` | STAFF (`catalog.draft`) | - | - | Update {skuId} |
| `POST  ` | `/api/v1/admin/catalog/products/{id}/submit` | STAFF (`catalog.draft`) | - | - | Submit For Review Resource |
| `POST  ` | `/api/v1/admin/catalog/products/{id}/unarchive` | STAFF (`catalog.draft`) | - | - | Create Unarchive |
| `GET   ` | `/api/v1/admin/coupons` | STAFF | - | - | Get Coupons |
| `POST  ` | `/api/v1/admin/coupons` | STAFF | - | - | Create Coupons |
| `PUT   ` | `/api/v1/admin/coupons/{id}` | STAFF | - | - | Update {id} |
| `POST  ` | `/api/v1/admin/coupons/{id}/activate` | STAFF | - | - | Create Activate |
| `POST  ` | `/api/v1/admin/coupons/{id}/pause` | STAFF | - | - | Create Pause |
| `GET   ` | `/api/v1/admin/customers` | STAFF (`pii.read.full`) | - | - | Get Customers |
| `GET   ` | `/api/v1/admin/customers/{id}` | STAFF (`pii.read.full`) | - | - | Get By ID |
| `POST  ` | `/api/v1/admin/customers/{id}/anonymize` | STAFF (`data_protection.anonymize`) | - | - | Anonymize Customer Data Resource |
| `POST  ` | `/api/v1/admin/customers/{id}/cod-block` | STAFF | - | - | Create Cod Block |
| `POST  ` | `/api/v1/admin/customers/{id}/ownership/confirm` | STAFF (`support.manage`) | - | - | Confirm Ownership |
| `POST  ` | `/api/v1/admin/customers/{id}/ownership/split-freeze` | STAFF (`support.manage`) | - | - | Create Split Freeze |
| `POST  ` | `/api/v1/admin/customers/{id}/store-credit` | STAFF | - | - | Create Store Credit |
| `POST  ` | `/api/v1/admin/customers/{id}/store-credit/withdraw` | STAFF | - | - | Create Withdraw |
| `POST  ` | `/api/v1/admin/godown/receive-runner-items` | STAFF | - | - | Create Receive Runner Items |
| `GET   ` | `/api/v1/admin/inventory/adjustments` | STAFF | - | - | Get Adjustments |
| `POST  ` | `/api/v1/admin/inventory/adjustments` | STAFF | - | - | Create Adjustments |
| `POST  ` | `/api/v1/admin/inventory/adjustments/{id}/approve` | STAFF | - | - | Approve Resource |
| `POST  ` | `/api/v1/admin/inventory/adjustments/{id}/reject` | STAFF | - | - | Reject Resource |
| `GET   ` | `/api/v1/admin/inventory/balances` | STAFF | - | - | Get Balances |
| `POST  ` | `/api/v1/admin/inventory/cycle-counts` | STAFF | - | - | Create Cycle Counts |
| `POST  ` | `/api/v1/admin/inventory/cycle-counts/{id}/complete` | STAFF | - | - | Create Complete |
| `POST  ` | `/api/v1/admin/inventory/cycle-counts/{id}/lines` | STAFF | - | - | Create Lines |
| `GET   ` | `/api/v1/admin/inventory/movements` | STAFF | - | - | Get Movements |
| `POST  ` | `/api/v1/admin/inventory/receive` | STAFF | - | - | Create Receive |
| `POST  ` | `/api/v1/admin/inventory/transfer` | STAFF | - | - | Create Transfer |
| `GET   ` | `/api/v1/admin/notifications/dead-letter` | STAFF | - | - | Get Dead Letter |
| `POST  ` | `/api/v1/admin/notifications/dead-letter/{id}/retry` | STAFF | - | - | Create Retry |
| `GET   ` | `/api/v1/admin/orders` | STAFF | - | - | Get Orders |
| `GET   ` | `/api/v1/admin/orders/{id}` | STAFF | - | - | Get By ID |
| `POST  ` | `/api/v1/admin/orders/{id}/cancel` | STAFF | - | - | Cancel Order Resource |
| `POST  ` | `/api/v1/admin/orders/{id}/notes` | STAFF | - | - | Create Notes |
| `POST  ` | `/api/v1/admin/orders/{id}/pickup-pin/reset` | STAFF | - | - | Create Reset |
| `GET   ` | `/api/v1/admin/payments` | STAFF | - | - | Get Payments |
| `POST  ` | `/api/v1/admin/payments/{tranId}/review` | STAFF | - | - | Create Review |
| `GET   ` | `/api/v1/admin/preorders` | STAFF | - | - | Get Preorders |
| `POST  ` | `/api/v1/admin/preorders/{id}/arrived` | STAFF | - | - | Create Arrived |
| `POST  ` | `/api/v1/admin/preorders/{id}/import-failed` | STAFF | - | - | Create Import Failed |
| `POST  ` | `/api/v1/admin/preorders/{id}/qc-verified` | STAFF | - | - | Create Qc Verified |
| `POST  ` | `/api/v1/admin/preorders/{id}/repricing` | STAFF | - | - | Create Repricing |
| `POST  ` | `/api/v1/admin/preorders/{id}/sourced` | STAFF | - | - | Create Sourced |
| `GET   ` | `/api/v1/admin/queues/dead-letter` | STAFF (`queues.admin`) | - | - | Get Dead Letter |
| `POST  ` | `/api/v1/admin/queues/dead-letter/{id}/retry` | STAFF (`queues.admin`) | - | - | Create Retry |
| `GET   ` | `/api/v1/admin/refunds` | STAFF | - | - | Get Refunds |
| `POST  ` | `/api/v1/admin/refunds` | STAFF | - | - | Create Refunds |
| `GET   ` | `/api/v1/admin/refunds/{id}` | STAFF | - | - | Get By ID |
| `POST  ` | `/api/v1/admin/refunds/{id}/approve` | STAFF | - | - | Approve Resource |
| `POST  ` | `/api/v1/admin/refunds/{id}/initiate-gateway` | STAFF | - | - | Create Initiate Gateway |
| `POST  ` | `/api/v1/admin/refunds/{id}/reject` | STAFF | - | - | Reject Resource |
| `GET   ` | `/api/v1/admin/reviews` | STAFF | - | - | Get Reviews |
| `POST  ` | `/api/v1/admin/reviews/{id}/moderate` | STAFF | - | - | Create Moderate |
| `GET   ` | `/api/v1/admin/security/audit-trail` | STAFF (`audit.read`) | - | - | Get Audit Trail |
| `GET   ` | `/api/v1/admin/security/audit-trail/verify` | STAFF (`audit.read`) | - | 5/min per device, 60/min per IP | Verify Audit Trail |
| `GET   ` | `/api/v1/admin/security/clone-alerts` | STAFF | - | - | Get Clone Alerts |
| `POST  ` | `/api/v1/admin/security/clone-alerts/{id}/resolve` | STAFF | - | - | Create Resolve |
| `GET   ` | `/api/v1/admin/settings/{key}` | STAFF (`settings.manage`) | - | - | Get By ID |
| `PUT   ` | `/api/v1/admin/settings/{key}` | STAFF (`settings.manage`) | - | - | Update {key} |
| `GET   ` | `/api/v1/admin/sourcing/purchases` | STAFF | - | - | Get Purchases |
| `POST  ` | `/api/v1/admin/sourcing/purchases/{id}/approve` | STAFF | - | - | Approve Resource |
| `GET   ` | `/api/v1/admin/sourcing/quarantine` | STAFF (`sourcing.quarantine.review`) | - | - | Get Quarantine |
| `POST  ` | `/api/v1/admin/sourcing/quarantine/{id}/accept` | STAFF (`sourcing.quarantine.review`) | - | - | Create Accept |
| `POST  ` | `/api/v1/admin/sourcing/quarantine/{id}/reject` | STAFF (`sourcing.quarantine.review`) | - | - | Reject Resource |
| `GET   ` | `/api/v1/admin/sourcing/sku/{skuId}/suppliers` | STAFF | - | - | Get Suppliers |
| `GET   ` | `/api/v1/admin/sourcing/tasks` | STAFF | - | - | Get Tasks |
| `POST  ` | `/api/v1/admin/sourcing/tasks/{taskId}/acknowledge` | STAFF | - | - | Create Acknowledge |
| `POST  ` | `/api/v1/admin/sourcing/tasks/{taskId}/assign` | STAFF | - | - | Create Assign |
| `POST  ` | `/api/v1/admin/sourcing/tasks/{taskId}/override-decision` | STAFF | - | - | Create Override Decision |
| `GET   ` | `/api/v1/admin/staff` | STAFF (`staff.manage`) | - | - | Get Staff |
| `POST  ` | `/api/v1/admin/staff` | STAFF (`staff.manage`) | - | - | Create Staff |
| `GET   ` | `/api/v1/admin/staff/{id}` | STAFF (`staff.manage`) | - | - | Get By ID |
| `PUT   ` | `/api/v1/admin/staff/{id}` | STAFF (`staff.manage`) | - | - | Update {id} |
| `POST  ` | `/api/v1/admin/staff/{id}/reset-password` | STAFF (`staff.manage`) | - | - | Create Reset Password |
| `POST  ` | `/api/v1/admin/staff/{id}/reset-totp` | STAFF (`staff.manage`) | - | - | Create Reset Totp |
| `POST  ` | `/api/v1/admin/staff/{id}/sessions/revoke` | STAFF (`staff.manage`) | - | - | Create Revoke |
| `GET   ` | `/api/v1/admin/suppliers` | STAFF | - | - | Get Suppliers |
| `POST  ` | `/api/v1/admin/suppliers` | STAFF | - | - | Create Suppliers |
| `GET   ` | `/api/v1/admin/suppliers/{id}` | STAFF | - | - | Get By ID |
| `PUT   ` | `/api/v1/admin/suppliers/{id}` | STAFF | - | - | Update {id} |
| `POST  ` | `/api/v1/admin/suppliers/{id}/reactivate` | STAFF | - | - | Reactivate Supplier Resource |
| `PUT   ` | `/api/v1/admin/suppliers/{id}/stock` | STAFF | - | - | Update Stock |
| `POST  ` | `/api/v1/admin/suppliers/{id}/suspend` | STAFF | - | - | Suspend Supplier Resource |
| `GET   ` | `/api/v1/admin/support/tasks` | STAFF (`support.manage`) | - | - | Get Tasks |
| `POST  ` | `/api/v1/admin/support/tasks/{id}/assign` | STAFF (`support.manage`) | - | - | Create Assign |
| `POST  ` | `/api/v1/admin/support/tasks/{id}/complete` | STAFF (`support.manage`) | - | - | Create Complete |

### Analytics & Feeds (1 endpoints)

| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST  ` | `/api/v1/analytics/events` | PUBLIC | - | - | Create Events |

### Authentication & Identity (9 endpoints)

| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST  ` | `/api/v1/auth/logout` | ANY | - | - | Logout Session Auth |
| `POST  ` | `/api/v1/auth/otp/send` | PUBLIC | - | 3/10m per phone, 20/hr per IP | Send Otp |
| `POST  ` | `/api/v1/auth/otp/verify` | PUBLIC | - | 5/min per device, 60/min per IP | Verify Otp |
| `GET   ` | `/api/v1/auth/sessions` | CUSTOMER | - | - | Get Sessions |
| `DELETE` | `/api/v1/auth/sessions/{id}` | CUSTOMER | - | - | Delete {id} |
| `POST  ` | `/api/v1/auth/staff/login` | PUBLIC | - | - | Staff Login Staff |
| `POST  ` | `/api/v1/auth/staff/password/change` | STAFF | - | - | Change Password |
| `POST  ` | `/api/v1/auth/staff/totp/confirm` | PUBLIC | - | - | Confirm Totp |
| `POST  ` | `/api/v1/auth/staff/totp/enroll` | PUBLIC | - | - | Enroll Totp |

### Cart & Reservations (4 endpoints)

| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET   ` | `/api/v1/cart` | CUSTOMER | - | - | Get Cart |
| `PUT   ` | `/api/v1/cart` | CUSTOMER | - | - | Update Cart |
| `POST  ` | `/api/v1/cart/reserve` | PUBLIC | - | 30/min per device | Create Reservation Hold Cart |
| `POST  ` | `/api/v1/cart/validate` | PUBLIC | - | - | Validate Cart Items Cart |

### Catalog & Search (7 endpoints)

| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET   ` | `/api/v1/catalog/categories` | PUBLIC | - | - | Get Categories |
| `GET   ` | `/api/v1/catalog/compare/{comparisonGroupId}` | PUBLIC | - | - | Get By ID |
| `GET   ` | `/api/v1/catalog/products` | PUBLIC | - | - | Get Products |
| `GET   ` | `/api/v1/catalog/products/{slug}` | PUBLIC | - | - | Get By ID |
| `GET   ` | `/api/v1/catalog/products/{slug}/reviews` | PUBLIC | - | - | Get Reviews |
| `GET   ` | `/api/v1/catalog/search` | PUBLIC | - | - | Get Search |
| `POST  ` | `/api/v1/catalog/skus/{skuId}/notify-me` | CUSTOMER | - | - | Create Notify Me |

### Customer & Account (20 endpoints)

| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET   ` | `/api/v1/customer/addresses` | CUSTOMER | - | - | Get Addresses |
| `POST  ` | `/api/v1/customer/addresses` | CUSTOMER | - | - | Create Addresses |
| `DELETE` | `/api/v1/customer/addresses/{id}` | CUSTOMER | - | - | Delete {id} |
| `PUT   ` | `/api/v1/customer/addresses/{id}` | CUSTOMER | - | - | Update {id} |
| `POST  ` | `/api/v1/customer/addresses/{id}/default` | CUSTOMER | - | - | Create Default |
| `GET   ` | `/api/v1/customer/claims` | CUSTOMER | - | - | Get Claims |
| `GET   ` | `/api/v1/customer/claims/{claimNumber}` | CUSTOMER | - | - | Get By ID |
| `POST  ` | `/api/v1/customer/deletion-request` | CUSTOMER | - | - | Create Deletion Request |
| `POST  ` | `/api/v1/customer/email/verify` | CUSTOMER | - | 5/min per device, 60/min per IP | Verify Email |
| `GET   ` | `/api/v1/customer/notification-preferences` | CUSTOMER | - | - | Get Notification Preferences |
| `PUT   ` | `/api/v1/customer/notification-preferences` | CUSTOMER | - | - | Update Notification Preferences |
| `POST  ` | `/api/v1/customer/phone-change/send` | CUSTOMER | - | - | Send Phone Change |
| `POST  ` | `/api/v1/customer/phone-change/verify` | CUSTOMER | - | 5/min per device, 60/min per IP | Verify Phone Change |
| `GET   ` | `/api/v1/customer/profile` | CUSTOMER | - | - | Get Profile |
| `PUT   ` | `/api/v1/customer/profile` | CUSTOMER | - | - | Update Profile |
| `GET   ` | `/api/v1/customer/store-credit` | CUSTOMER | - | - | Get Store Credit |
| `GET   ` | `/api/v1/customer/warranties` | CUSTOMER | - | - | Get Warranties |
| `DELETE` | `/api/v1/customer/wishlist` | CUSTOMER | - | - | Delete Wishlist |
| `GET   ` | `/api/v1/customer/wishlist` | CUSTOMER | - | - | Get Wishlist |
| `POST  ` | `/api/v1/customer/wishlist` | CUSTOMER | - | - | Create Wishlist |

### Customer Reviews (1 endpoints)

| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST  ` | `/api/v1/reviews` | CUSTOMER | - | - | Create Reviews |

### External Webhooks (2 endpoints)

| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST  ` | `/api/v1/webhooks/couriers/{courier}` | PUBLIC | - | - | Create {courier} |
| `POST  ` | `/api/v1/webhooks/notifications/{provider}` | OPTIONAL | - | - | Create {provider} |

### Field Runner Sourcing (9 endpoints)

| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET   ` | `/api/v1/runner/float/current` | STAFF | - | - | Get Current |
| `POST  ` | `/api/v1/runner/float/return` | STAFF | - | - | Create Return |
| `POST  ` | `/api/v1/runner/purchases/{id}/receipt-complete` | STAFF | - | - | Create Receipt Complete |
| `POST  ` | `/api/v1/runner/purchases/{id}/receipt-upload-url` | STAFF | - | - | Create Receipt Upload Url |
| `POST  ` | `/api/v1/runner/sync` | STAFF | - | - | Create Sync |
| `GET   ` | `/api/v1/runner/tasks` | STAFF | - | - | Get Tasks |
| `POST  ` | `/api/v1/runner/tasks/{taskId}/contacted` | STAFF | - | - | Create Contacted |
| `POST  ` | `/api/v1/runner/tasks/{taskId}/request-override` | STAFF | - | - | Create Request Override |
| `POST  ` | `/api/v1/runner/tasks/{taskId}/sync-purchase` | STAFF | - | - | Create Sync Purchase |

### Finance, Ledger & Tax (24 endpoints)

| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST  ` | `/api/v1/finance/courier-settlements` | STAFF (`settlement.reconcile`) | - | - | Create Courier Settlements |
| `GET   ` | `/api/v1/finance/dashboard` | STAFF | - | - | Get Dashboard |
| `POST  ` | `/api/v1/finance/drawers/{id}/reconcile` | STAFF | - | - | Reconcile Cash Drawer Resource |
| `GET   ` | `/api/v1/finance/exceptions` | STAFF | - | - | Get Exceptions |
| `POST  ` | `/api/v1/finance/exceptions/{id}/resolve` | STAFF (`settlement.reconcile`) | - | - | Create Resolve |
| `GET   ` | `/api/v1/finance/exports/{id}` | STAFF | - | - | Get By ID |
| `POST  ` | `/api/v1/finance/float/{id}/count` | STAFF | - | - | Create Count |
| `POST  ` | `/api/v1/finance/float/{id}/signoff` | STAFF | - | - | Create Signoff |
| `POST  ` | `/api/v1/finance/float/issue` | STAFF | - | - | Create Issue |
| `GET   ` | `/api/v1/finance/float/sessions` | STAFF | - | - | Get Sessions |
| `GET   ` | `/api/v1/finance/float/variance-report` | STAFF | - | - | Get Variance Report |
| `POST  ` | `/api/v1/finance/gateway-settlements` | STAFF (`settlement.reconcile`) | - | - | Create Gateway Settlements |
| `GET   ` | `/api/v1/finance/invoices/{orderId}/mushak-6-3` | ANY | - | - | Get Mushak 6 3 |
| `GET   ` | `/api/v1/finance/ledger/accounts/{code}/statement` | STAFF | - | - | Get Statement |
| `GET   ` | `/api/v1/finance/ledger/entries` | STAFF | - | - | Get Entries |
| `GET   ` | `/api/v1/finance/ledger/trial-balance` | STAFF | - | - | Get Trial Balance |
| `POST  ` | `/api/v1/finance/reconciliation/courier-csv` | STAFF (`settlement.reconcile`) | - | - | Upload Courier Settlement CSV Reconciliation |
| `POST  ` | `/api/v1/finance/refunds/execute` | STAFF | - | - | Execute Manual Refund Payout Refunds |
| `GET   ` | `/api/v1/finance/reports/{reportType}` | STAFF | - | - | Get By ID |
| `POST  ` | `/api/v1/finance/reports/exports` | STAFF | - | - | Create Exports |
| `GET   ` | `/api/v1/finance/reports/exports/{id}` | STAFF | - | - | Get By ID |
| `GET   ` | `/api/v1/finance/supplier-payables` | STAFF | - | - | Get Supplier Payables |
| `POST  ` | `/api/v1/finance/supplier-payments` | STAFF | - | - | Create Supplier Payments |
| `POST  ` | `/api/v1/finance/supplier-refunds` | STAFF | - | - | Create Supplier Refunds |

### Geo Hierarchy (4 endpoints)

| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET   ` | `/api/v1/geo/areas` | PUBLIC | - | - | Get Areas |
| `GET   ` | `/api/v1/geo/districts` | PUBLIC | - | - | Get Districts |
| `GET   ` | `/api/v1/geo/divisions` | PUBLIC | - | - | Get Divisions |
| `GET   ` | `/api/v1/geo/thanas` | PUBLIC | - | - | Get Thanas |

### Logistics & Courier (9 endpoints)

| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST  ` | `/api/v1/logistics/book-consignment` | STAFF | - | - | Create Book Consignment |
| `GET   ` | `/api/v1/logistics/dispatch-queue` | STAFF | - | - | Get Dispatch Queue |
| `GET   ` | `/api/v1/logistics/manual-console` | STAFF | - | - | Get Manual Console |
| `POST  ` | `/api/v1/logistics/orders/{orderId}/pack` | STAFF | - | - | Pack Order & Verify Seals Resource |
| `POST  ` | `/api/v1/logistics/rto/{shipmentId}/receive` | STAFF | - | - | Create Receive |
| `GET   ` | `/api/v1/logistics/shipments/{id}/label` | STAFF | - | - | Get Label |
| `POST  ` | `/api/v1/logistics/shipments/{id}/manual-booking` | STAFF | - | - | Create Manual Booking |
| `POST  ` | `/api/v1/logistics/shipments/handover` | STAFF | - | - | Handover Consignment / Items Shipments |
| `POST  ` | `/api/v1/logistics/webhooks/{courier}` | PUBLIC | - | - | Create {courier} |

### Marketing Feeds (2 endpoints)

| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET   ` | `/feeds/google.xml` | PUBLIC | - | - | Get Google.xml |
| `GET   ` | `/feeds/meta.csv` | PUBLIC | - | - | Get Meta.csv |

### Media & Uploads (5 endpoints)

| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET   ` | `/api/v1/media/{id}/url` | PUBLIC | - | - | Get Url |
| `POST  ` | `/api/v1/media/uploads` | ANY | - | - | Create Uploads |
| `POST  ` | `/api/v1/media/uploads/{id}/abort` | ANY | - | - | Create Abort |
| `POST  ` | `/api/v1/media/uploads/{id}/complete` | ANY | - | - | Create Complete |
| `POST  ` | `/api/v1/media/uploads/{id}/parts` | ANY | - | - | Create Parts |

### Notifications (1 endpoints)

| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET   ` | `/api/v1/notifications/opt-out` | OPTIONAL | - | - | Get Opt Out |

### Orders & Fulfillment (13 endpoints)

| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET   ` | `/api/v1/orders` | CUSTOMER | - | - | Get Orders |
| `GET   ` | `/api/v1/orders/{orderNumber}` | CUSTOMER | - | - | Get By ID |
| `POST  ` | `/api/v1/orders/{orderNumber}/balance` | CUSTOMER | - | - | Pay Pre-Order Balance Resource |
| `POST  ` | `/api/v1/orders/{orderNumber}/cancel` | CUSTOMER | - | - | Cancel Order Resource |
| `GET   ` | `/api/v1/orders/{orderNumber}/invoices` | ANY | - | - | Get Invoices |
| `POST  ` | `/api/v1/orders/{orderNumber}/lines/{lineId}/stockout-choice` | ANY | - | - | Create Stockout Choice |
| `POST  ` | `/api/v1/orders/{orderNumber}/pay` | CUSTOMER | - | - | Initiate Order Payment Resource |
| `POST  ` | `/api/v1/orders/{orderNumber}/preorder/delay-choice` | CUSTOMER | - | - | Create Delay Choice |
| `POST  ` | `/api/v1/orders/{orderNumber}/preorder/repricing` | CUSTOMER | - | - | Create Repricing |
| `POST  ` | `/api/v1/orders/{orderNumber}/preorder/switch` | CUSTOMER | - | - | Create Switch |
| `GET   ` | `/api/v1/orders/{orderNumber}/refunds` | ANY | - | - | Get Refunds |
| `POST  ` | `/api/v1/orders/{orderNumber}/refunds/{id}/choose-store-credit` | CUSTOMER | - | - | Create Choose Store Credit |
| `POST  ` | `/api/v1/orders/checkout` | CUSTOMER | Yes (`checkout`) | 10/hr per customer flag | Place Order Checkout Orders |

### Payments & Gateways (4 endpoints)

| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST  ` | `/api/v1/payments/sslcommerz/cancel` | PUBLIC | - | - | Cancel Order Sslcommerz |
| `POST  ` | `/api/v1/payments/sslcommerz/fail` | PUBLIC | - | - | Create Fail |
| `POST  ` | `/api/v1/payments/sslcommerz/ipn` | PUBLIC | - | - | Create Ipn |
| `POST  ` | `/api/v1/payments/sslcommerz/success` | PUBLIC | - | - | Create Success |

### Quality Control & Seals (9 endpoints)

| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST  ` | `/api/v1/qc/inspect` | STAFF | - | - | QC Inspection Qc |
| `POST  ` | `/api/v1/qc/mint-seal` | STAFF | - | - | Mint Holographic Seal Qc |
| `GET   ` | `/api/v1/qc/queue` | STAFF | - | - | Get Queue |
| `POST  ` | `/api/v1/qc/records/{id}/supervisor-audit` | STAFF | - | - | Create Supervisor Audit |
| `GET   ` | `/api/v1/qc/sampling-queue` | STAFF | - | - | Get Sampling Queue |
| `POST  ` | `/api/v1/qc/seals/{sealId}/apply` | STAFF | - | - | Create Apply |
| `POST  ` | `/api/v1/qc/seals/{sealId}/printed` | STAFF | - | - | Create Printed |
| `POST  ` | `/api/v1/qc/void-requests/{id}/approve` | STAFF | - | - | Approve Resource |
| `POST  ` | `/api/v1/qc/void-seal` | STAFF | - | - | Request Seal Void Qc |

### Realtime SSE Events (2 endpoints)

| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST  ` | `/api/v1/events/{eventId}/ack` | STAFF | - | - | Create Ack |
| `GET   ` | `/api/v1/events/stream` | STAFF | - | - | Get Stream |

### SEO & Sitemaps (1 endpoints)

| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET   ` | `/api/v1/seo/sitemap-entries` | PUBLIC | - | - | Get Sitemap Entries |

### Showroom Point of Sale (6 endpoints)

| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST  ` | `/api/v1/pos/drawer/close` | STAFF | - | - | Create Close |
| `POST  ` | `/api/v1/pos/drawer/open` | STAFF | - | - | Create Open |
| `POST  ` | `/api/v1/pos/pickup/handover` | STAFF | - | - | Handover Consignment / Items Pickup |
| `POST  ` | `/api/v1/pos/pickup/verify-pin` | STAFF | - | 5/min per device, 60/min per IP | Verify Pickup PIN Pickup |
| `GET   ` | `/api/v1/pos/stock` | STAFF | - | - | Get Stock |
| `POST  ` | `/api/v1/pos/walk-in-sale` | STAFF | - | - | Process Showroom Walk-in Sale Pos |

### System & Utilities (5 endpoints)

| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET   ` | `/admin/queues` | STAFF (`queues.admin`) | - | - | Get Queues |
| `GET   ` | `/api/docs` | PUBLIC | - | - | Get Docs |
| `POST  ` | `/api/v1/_debug/echo` | PUBLIC | - | - | Create Echo |
| `POST  ` | `/api/v1/_dev/courier/{consignment}/advance` | PUBLIC | - | - | Create Advance |
| `GET   ` | `/api/v1/openapi.json` | PUBLIC | - | - | Get Openapi.json |

### System Health (1 endpoints)

| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET   ` | `/api/v1/health` | PUBLIC | - | - | Get Health |

### Trust & Seal Verification (2 endpoints)

| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET   ` | `/api/v1/verify` | PUBLIC | - | 5/min per device, 60/min per IP | Verify V1 |
| `GET   ` | `/api/v1/verify/{sealId}` | PUBLIC | - | 5/min per device, 60/min per IP | Get By ID |

### Warranty & RMA Claims (11 endpoints)

| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET   ` | `/api/v1/rma/claims` | ANY | - | - | Get Claims |
| `POST  ` | `/api/v1/rma/claims` | ANY | - | - | Create Claims |
| `GET   ` | `/api/v1/rma/claims/{id}` | ANY | - | - | Get By ID |
| `POST  ` | `/api/v1/rma/claims/{id}/adjudicate` | STAFF | - | - | Create Adjudicate |
| `POST  ` | `/api/v1/rma/claims/{id}/close` | STAFF | - | - | Create Close |
| `POST  ` | `/api/v1/rma/claims/{id}/dispatch-replacement` | STAFF | - | - | Create Dispatch Replacement |
| `POST  ` | `/api/v1/rma/claims/{id}/inspect` | STAFF | - | - | QC Inspection Resource |
| `POST  ` | `/api/v1/rma/claims/{id}/liaison` | STAFF | - | - | Create Liaison |
| `POST  ` | `/api/v1/rma/claims/{id}/liaison/returned` | STAFF | - | - | Create Returned |
| `POST  ` | `/api/v1/rma/claims/{id}/receive` | STAFF | - | - | Create Receive |
| `POST  ` | `/api/v1/rma/upload-url` | ANY | - | - | Create Upload Url |

## 3. Intentional Architectural Deviations Against `api-spec.md`

The following architectural enhancements and intentional deviations from the original `api-spec.md` v2.0 draft have been approved and recorded in `docs/DECISIONS.md`:

| # | Feature / Endpoint | Original `api-spec.md` Specification | Implemented Architectural Design | Rationale & `DECISIONS.md` Reference |
| :-: | :--- | :--- | :--- | :--- |
| 1 | **Pre-Order Balance COD Cap**<br>`POST /orders/:id/balance` | Allowed unrestricted COD balance payments | Strictly capped COD balance payments at ৳30,000 (3,000,000 paisa) with `422 ERR_COD_NOT_ALLOWED` | High-value courier COD carries severe courier cash handling and default risks. Pre-order balances $>৳30,000$ must be settled online or at the Nawabpur showroom counter. *(DECISIONS.md #33, PRD §3.3.4)* |
| 2 | **Public `/verify` Clone Alerts**<br>`GET /verify/:sealId` | Suggested showing clone suspicion banner to visitor | Returns standard valid seal metadata to public visitor; emits internal Class A incident alert to Super Admin | Revealing clone suspicion on public lookups tips off counterfeiters and causes panic for legitimate customers who bought genuine items. *(DECISIONS.md #38, PRD §3.2.3)* |
| 3 | **Showroom Walk-in Sale Lifecycle**<br>`POST /pos/walk-in-sale` | Multi-step transition through `PENDING_PAYMENT` | Created directly in terminal `DELIVERED_COUNTER` status | Walk-in counter sales involve immediate cash/card payment and physical unit handover on the spot; bypassing intermediary states accurately reflects physical reality. *(DECISIONS.md #29, #45, PRD §3.12)* |
| 4 | **Media Upload Strategy**<br>`POST /media/uploads` | Single presigned S3 PUT for all files | Dual-mode: Direct presigned PUT ($le$ 10MB) vs. S3 multipart chunking ($>$ 10MB) | Ensures zero-latency uploads for smartphone RMA photos and receipts, while providing robust resumable chunking for large 300MB unboxing videos. *(DECISIONS.md #47, PRD §3.8.8)* |
| 5 | **Courier Webhook Aliases**<br>`POST /webhooks/couriers/:courier` | Single path under `/webhooks/couriers/:courier` | Dual mount: `/api/v1/logistics/webhooks/:courier` and `/api/v1/webhooks/couriers/:courier` | Backwards-compatibility with varying courier provider dashboard configuration formats (Steadfast, Pathao, RedX). *(DECISIONS.md #39)* |
| 6 | **Customer Data Anonymization**<br>`POST /admin/customers/:id/anonymize` | Hard `DELETE` customer record | Irreversible phone SHA-256 hashing and PII masking; preserves balanced journal entries and Mushak invoices | Statutory Bangladesh accounting and VAT compliance requires 6-year retention of sales ledgers, while honoring Customer Right to be Forgotten. *(DECISIONS.md #64, PRD §3.18)* |
| 7 | **Store Credit Expiry Accounting**<br>`Daily 00:15 Asia/Dhaka Job` | Mutation of historical store credit balance | Append-only negative `EXPIRY` entry with ledger reversal `Dr 2020 / Cr 5400` | Preserves immutable store credit log integrity without mutating historical rows or ledger lines. *(DECISIONS.md #27, PRD §3.14.6)* |
| 8 | **Cash Variance Accounting**<br>`POST /finance/drawers/:id/reconcile` | Credited to Miscellaneous Income | Credited directly to Operating Expense Account 5310 (Cash Variance) | Nets cash overages directly against shortages within operating expenses rather than segregating into non-operating income. *(DECISIONS.md #28, PRD §3.13)* |
| 9 | **Pre-Order Delay Choice Goodwill**<br>`POST /orders/:id/preorder/delay-choice` | Awarded immediately upon delay notification | Awarded upon physical arrival at Nawabpur godown (`ARRIVED_GODOWN`) | Preserves price lock while avoiding premature unearned credit distribution if customs or international cargo ultimately fails. *(DECISIONS.md #32, PRD §3.14)* |
| 10 | **Runner Sourcing Privacy**<br>`GET /runner/tasks` | Included customer shipping address | Zero customer PII in runner task DTOs (SKU, title, stall, max price only) | Protects customer privacy and prevents direct off-platform courier dispatch bypass. *(DECISIONS.md #35, PRD §3.9)* |
| 11 | **Partial Stockout Delivery Fee**<br>`POST /orders/:id/lines/:lineId/stockout-choice` | Pro-rata delivery fee reallocation | Delivery fee charged once only across partial stockout splits (EC-05) | Protects customer from additional delivery fees when Nawabpur stalls run out of secondary line items. *(DECISIONS.md #37, PRD §3.4.4)* |
| 12 | **Mushak 6.3 Tax Point Timing**<br>`GET /finance/invoices/:id/mushak-6-3` | Issued upon order creation | Issued at Revenue Recognition (Delivery / Counter Handover) | Mushak 6.3 VAT tax invoices with gapless fiscal-year serials are issued when ownership and goods transfer. *(DECISIONS.md #31, PRD §3.12)* |
| 13 | **Last SUPER_ADMIN Guard**<br>`DELETE /admin/staff/:id` | Standard RBAC check | System prevents deleting or revoking roles of the last active SUPER_ADMIN | Prevents catastrophic administrative lockout. *(DECISIONS.md #62, PRD §3.9)* |
| 14 | **RMA Media 180-Day Retention**<br>`POST /rma/claims/:id/close` | Indefinite media storage | Schedules linked unboxing videos and proofs for cleanup 180 days after closure | Reduces cloud storage bloat while exceeding the statutory Bangladesh consumer dispute window. *(DECISIONS.md #49, #55, PRD §3.8.8)* |

---
*End of API Specification Documentation.*
