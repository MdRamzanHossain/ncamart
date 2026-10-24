# REST API Specification — NCAMart

**Document Version:** 2.0 (Production Engineering API Specification)  
**Status:** Approved Technical Design Artifact  
**Date:** 2026-10-20  
**Target Domain:** [ncamart.com](https://ncamart.com)  
**Base URL:** `https://ncamart.com/api/v1` (Storefront SSR & REST Routes)  
**Foundational References:** [PRD.md](./PRD.md) (v1.4), [architechture.md](./architechture.md) (v1.1), [dfd.md](./dfd.md) (v2.0), [database.md](./database.md), & [database-schema.md](./database-schema.md)  
**Monetary Standard:** All monetary amounts are strictly represented in **Integer Paisa (1 BDT = 100 Paisa)** without floating point rounding.

---

## 1. Global API Standards & Conventions

### 1.1 Authentication & Authorization Headers
* **Customer & Staff Web Sessions:** Authenticated via `HttpOnly`, `Secure`, `SameSite=Lax` cookie: `nca_sid=<session_token>`.
* **Mobile / PWA / Headless API Requests:** Authenticated via HTTP Authorization header:
  ```http
  Authorization: Bearer <session_token>
  ```
* **Runner PWA Offline Mutation Idempotency Header:**
  ```http
  X-Client-Mutation-Id: <UUIDv4>
  ```
* **Internal Worker & Webhook Ingestion API Key:**
  ```http
  X-Internal-Secret: <HMAC_SHA256_SECRET>
  ```

### 1.2 Rate Limiting Policies
* **Public Device Telemetry Cookie:** `nca_did=<uuid>` (Issued on first request to safely handle CGNAT mobile telecom IP sharing in Bangladesh).
* **Public / Verify Portal:** 5 requests/minute per `device_id` (`nca_did`) AND 60 requests/minute per client IP. Exceeding returns `HTTP 429 Too Many Requests`.
* **OTP Sending:** Max 3 requests per 10 minutes per phone number AND max 20 requests per hour per IP.

### 1.3 Uniform Error Response Envelope
All non-2xx responses adhere to the following standard RFC 7807 compatible envelope:
```json
{
  "error": {
    "code": "ERR_MIXED_CART_DISALLOWED",
    "message": "Pure cart isolation violated: Pre-Order and Drop-and-Pack items cannot be checked out in the same order.",
    "status": 422,
    "details": {
      "rejected_skus": ["UGR-65W-BLK", "HIK-TC01-PRE"]
    },
    "timestamp": "2026-10-20T10:30:00.000Z"
  }
}
```

---

## 2. Authentication & Identity Module (`/api/v1/auth`)

### 2.1 Send OTP Code
* **Endpoint:** `POST /api/v1/auth/otp/send`
* **Auth Requirement:** **PUBLIC** (Rate limited: 3/10m per phone, 20/hr per IP)
* **Description:** Generates a 6-digit OTP code, hashes it with SHA-256 into Redis with a 180s TTL, and enqueues a high-priority Class A SMS job.
* **Request Body:**
  ```json
  {
    "phone": "+8801712345678",
    "captcha_token": "cf_turnstile_response_token_here"
  }
  ```
* **Response Paths:**
  * `200 OK`:
    ```json
    {
      "success": true,
      "message": "OTP verification code sent to +8801712345678",
      "expires_in_seconds": 180,
      "retry_after_seconds": 60
    }
    ```
  * `400 Bad Request`: `{"error": {"code": "ERR_INVALID_PHONE", "message": "Invalid Bangladeshi MSISDN format"}}`
  * `429 Too Many Requests`: `{"error": {"code": "ERR_OTP_RATE_LIMIT", "message": "Max 3 OTP requests allowed per 10 minutes"}}`

---

### 2.2 Verify OTP & Authenticate
* **Endpoint:** `POST /api/v1/auth/otp/verify`
* **Auth Requirement:** **PUBLIC**
* **Description:** Validates the SHA-256 OTP hash from Redis. Merges guest carts if applicable. Sets `nca_sid` cookie.
* **Request Body:**
  ```json
  {
    "phone": "+8801712345678",
    "otp_code": "482910",
    "device_id": "did_991823abce847"
  }
  ```
* **Response Paths:**
  * `200 OK` (Sets Header `Set-Cookie: nca_sid=...; HttpOnly; Secure; SameSite=Lax`):
    ```json
    {
      "success": true,
      "user": {
        "id": "c4918a22-3819-4b62-8172-108291a92847",
        "phone": "+8801712345678",
        "full_name": "Rahim Ahmed",
        "role": "CUSTOMER",
        "dormant_flag": false,
        "is_cod_blacklisted": false
      },
      "session_token": "sess_8f2910acb73918e90a"
    }
    ```
  * `401 Unauthorized`: `{"error": {"code": "ERR_OTP_INVALID", "message": "Incorrect OTP code. 2 attempts remaining."}}`
  * `410 Gone`: `{"error": {"code": "ERR_OTP_EXPIRED", "message": "OTP has expired. Please request a new code."}}`

---

### 2.3 Staff Credentials & 2FA TOTP Login
* **Endpoint:** `POST /api/v1/auth/staff/login`
* **Auth Requirement:** **PUBLIC (Staff Only)**
* **Description:** Authenticates staff member using Argon2id password hash and AES-256 decrypted TOTP authenticator token.
* **Request Body:**
  ```json
  {
    "phone": "+8801812345678",
    "password": "SuperSecretStaffPassword123!",
    "totp_code": "829104"
  }
  ```
* **Response Paths:**
  * `200 OK`:
    ```json
    {
      "success": true,
      "staff": {
        "id": "stf_8829104",
        "name": "Kamal Hossain",
        "role": "QC_TECHNICIAN",
        "totp_enabled": true
      },
      "session_token": "staff_sess_781290ab"
    }
    ```
  * `401 Unauthorized`: `{"error": {"code": "ERR_STAFF_AUTH_FAILED", "message": "Invalid password or TOTP code"}}`

---

### 2.4 User / Staff Logout
* **Endpoint:** `POST /api/v1/auth/logout`
* **Auth Requirement:** **AUTHENTICATED (Customer or Staff)**
* **Description:** Revokes active session from database and clears cookie.
* **Request Body:** None
* **Response Paths:**
  * `200 OK`: `{"success": true, "message": "Logged out successfully"}`

---

### 2.5 Active Sessions Management
* **Endpoint:** `GET /api/v1/auth/sessions` & `DELETE /api/v1/auth/sessions/:sessionId`
* **Auth Requirement:** **AUTHENTICATED**
* **Description:** Lists all active devices and permits remote revocation of other sessions.
* **Response Paths:**
  * `200 OK`:
    ```json
    {
      "sessions": [
        {
          "session_id": "sess_uuid_1",
          "device_label": "Chrome on Windows 11",
          "ip_address": "103.205.71.14",
          "is_current": true,
          "created_at": "2026-10-20T08:00:00.000Z",
          "expires_at": "2026-11-20T08:00:00.000Z"
        }
      ]
    }
    ```

---

## 3. Customer Profile & Address Book (`/api/v1/customer`)

### 3.1 Get Profile & Fraud Risk Summary
* **Endpoint:** `GET /api/v1/customer/profile`
* **Auth Requirement:** **CUSTOMER**
* **Response Paths:**
  * `200 OK`:
    ```json
    {
      "id": "c4918a22-3819-4b62-8172-108291a92847",
      "phone": "+8801712345678",
      "full_name": "Rahim Ahmed",
      "email": "rahim@example.com",
      "risk_profile": {
        "delivered_orders_count": 4,
        "rto_count_12m": 0,
        "is_cod_blacklisted": false,
        "cod_eligible_100_percent": true
      }
    }
    ```

---

### 3.2 Manage Customer Address Book
* **Endpoint:** `GET /api/v1/customer/addresses` | `POST /api/v1/customer/addresses`
* **Auth Requirement:** **CUSTOMER**
* **Request Body (POST):**
  ```json
  {
    "label": "HOME",
    "district": "Dhaka",
    "thana": "Dhanmondi",
    "street_address": "House 42, Road 7/A, Dhanmondi R/A",
    "is_default": true
  }
  ```
* **Response Paths:**
  * `201 Created`: `{"success": true, "address_id": "addr_uuid_8812"}`

---

### 3.3 Active Warranties Portal ("My Warranties")
* **Endpoint:** `GET /api/v1/customer/warranties`
* **Auth Requirement:** **CUSTOMER**
* **Description:** Retrieves all active Seal IDs registered to this customer with live warranty countdowns.
* **Response Paths:**
  * `200 OK`:
    ```json
    {
      "active_warranties": [
        {
          "seal_id": "NCA-4K9W-8M2P",
          "product_title_en": "UGREEN Nexode 65W GaN Fast Charger",
          "product_tier": "AUTHENTIC",
          "warranty_days_total": 730,
          "warranty_start": "2026-10-15T12:00:00.000Z",
          "warranty_end": "2028-10-15T12:00:00.000Z",
          "days_remaining": 725,
          "status": "ACTIVE"
        }
      ]
    }
    ```

---

## 4. Catalog, Spec Comparison & Search (`/api/v1/catalog`)

### 4.1 Browse Products with Two-Tier Filters
* **Endpoint:** `GET /api/v1/catalog/products`
* **Auth Requirement:** **PUBLIC**
* **Query Parameters:**
  * `category` (string, slug)
  * `tier` (`AUTHENTIC` | `BUDGET_SMART`)
  * `brand` (string)
  * `price_min_paisa`, `price_max_paisa` (integer)
  * `sort` (`PRICE_ASC` | `PRICE_DESC` | `NEWEST`)
  * `page`, `limit` (integer)
* **Response Paths:**
  * `200 OK`:
    ```json
    {
      "products": [
        {
          "id": "prod_ugreen_65w",
          "title_en": "UGREEN Nexode 65W GaN Fast Charger",
          "title_bn": "ইউগ্রিন নেক্সোড ৬৫ ওয়াট গ্যান ফাস্ট চার্জার",
          "slug": "ugreen-nexode-65w-gan-charger",
          "product_tier": "AUTHENTIC",
          "brand_name": "UGREEN",
          "min_regular_price_paisa": 250000,
          "min_sale_price_paisa": 235000,
          "primary_image_url": "https://cdn.ncamart.com/products/ugreen-65w-front.webp",
          "comparison_group_id": "comp_grp_65w_chargers"
        }
      ],
      "pagination": { "page": 1, "limit": 20, "total_count": 48, "total_pages": 3 }
    }
    ```

---

### 4.2 Get Product Detail by Slug
* **Endpoint:** `GET /api/v1/catalog/products/:slug`
* **Auth Requirement:** **PUBLIC**
* **Response Paths:**
  * `200 OK`: Returns master product, all variant SKUs, attributes, spec template values, and comparison points.

---

### 4.3 Side-by-Side Comparison Diff Matrix
* **Endpoint:** `GET /api/v1/catalog/compare/:comparisonGroupId`
* **Auth Requirement:** **PUBLIC**
* **Description:** Retrieves side-by-side specs comparing the Authentic product against its Budget Smart counterpart.
* **Response Paths:**
  * `200 OK`:
    ```json
    {
      "comparison_group_id": "comp_grp_65w_chargers",
      "authentic_item": {
        "title_en": "UGREEN Nexode 65W GaN Charger",
        "price_paisa": 250000,
        "warranty_label": "2-Year Official Replacement",
        "specs": { "max_wattage": "65W", "operating_temp": "<45°C", "chipset": "Navitas GaN III" }
      },
      "budget_smart_item": {
        "title_en": "NCA Pro 65W Quick Charger (Tested Budget)",
        "price_paisa": 112500,
        "warranty_label": "7-Day NCAMart Shop Replacement",
        "specs": { "max_wattage": "65W", "operating_temp": "58°C", "chipset": "Innoscience OEM" }
      },
      "comparison_verdict": {
        "summary_en": "Choose Authentic for cooler full-load operation and 2-year peace of mind; choose Budget Smart to save 55% with verified in-house lab safety.",
        "summary_bn": "লং টার্ম ২ বছরের ওয়ারেন্টি ও প্রিমিয়াম বিল্ডের জন্য অথেনটিক; আর ৫৫% টাকা সাশ্রয়ে ল্যাব টেস্টেড পারফরম্যান্সের জন্য বাজেট স্মার্ট বেছে নিন।"
      }
    }
    ```

---

### 4.4 Multi-Lingual Search (Meilisearch)
* **Endpoint:** `GET /api/v1/catalog/search`
* **Auth Requirement:** **PUBLIC**
* **Query Parameters:** `q` (Bangla, English, or Banglish), `tier`, `category`, `page`
* **Response Paths:**
  * `200 OK`: Returns typo-tolerant search results with highlighted matching snippets.

---

## 5. Cart, Pricing & Stock Reservation (`/api/v1/cart`)

### 5.1 Server-Side Price & Sourcing Isolation Validator
* **Endpoint:** `POST /api/v1/cart/validate`
* **Auth Requirement:** **PUBLIC / GUEST / CUSTOMER**
* **Description:** Zero client trust. Reads authoritative base prices from database. Rejects mixed carts.
* **Request Body:**
  ```json
  {
    "items": [
      { "sku_id": "sku_ugr_65w_black", "quantity": 1 }
    ],
    "coupon_code": "LAUNCH10"
  }
  ```
* **Response Paths:**
  * `200 OK`:
    ```json
    {
      "order_type": "REGULAR_DROP_PACK",
      "items": [
        {
          "sku_id": "sku_ugr_65w_black",
          "title_en": "UGREEN Nexode 65W GaN Charger (Black)",
          "quantity": 1,
          "unit_price_paisa": 250000,
          "allocated_discount_paisa": 25000,
          "total_price_paisa": 225000
        }
      ],
      "financial_breakup": {
        "subtotal_paisa": 250000,
        "discount_paisa": 25000,
        "delivery_fee_dhaka_paisa": 8000,
        "delivery_fee_nationwide_paisa": 15000,
        "payable_subtotal_paisa": 225000
      }
    }
    ```
  * `422 Unprocessable Entity`:
    ```json
    {
      "error": {
        "code": "ERR_MIXED_CART_DISALLOWED",
        "message": "Cart contains both PRE_ORDER and REGULAR_DROP_PACK items. Please place separate orders."
      }
    }
    ```

---

### 5.2 Acquire 10-Minute Cart Stock Lock
* **Endpoint:** `POST /api/v1/cart/reserve`
* **Auth Requirement:** **PUBLIC / GUEST / CUSTOMER**
* **Description:** Executes PostgreSQL conditional update:
  `UPDATE inventory_balances SET reserved = reserved + qty WHERE on_hand - reserved >= qty`
* **Request Body:**
  ```json
  {
    "items": [
      { "sku_id": "sku_ugr_65w_black", "quantity": 1 }
    ],
    "location_code": "GODOWN_NAWABPUR"
  }
  ```
* **Response Paths:**
  * `200 OK`:
    ```json
    {
      "success": true,
      "reservation_id": "res_88291048-2819-4829-9921",
      "expires_at": "2026-10-20T10:40:00.000Z",
      "duration_seconds": 600
    }
    ```
  * `409 Conflict`: `{"error": {"code": "ERR_INSUFFICIENT_STOCK", "message": "Only 0 units available for reservation"}}`

---

## 6. Checkout & Order Lifecycle (`/api/v1/orders`)

### 6.1 Order Checkout Submission
* **Endpoint:** `POST /api/v1/orders/checkout`
* **Auth Requirement:** **AUTHENTICATED (Customer or OTP Verified Guest)**
* **Description:** Creates order inside an ACID transaction. Evaluates COD anti-fraud eligibility.
* **Request Body:**
  ```json
  {
    "channel": "STOREFRONT_WEB",
    "order_type": "REGULAR_DROP_PACK",
    "reservation_ids": ["res_88291048-2819-4829-9921"],
    "items": [
      { "sku_id": "sku_ugr_65w_black", "quantity": 1 }
    ],
    "delivery_channel": "COURIER",
    "delivery_zone": "INSIDE_DHAKA",
    "shipping_address": {
      "consignee_name": "Rahim Ahmed",
      "phone": "+8801712345678",
      "district": "Dhaka",
      "thana": "Dhanmondi",
      "street_address": "House 42, Road 7/A"
    },
    "payment_mode": "100_PERCENT_COD",
    "coupon_code": "LAUNCH10",
    "store_credit_paisa": 0,
    "mushak_requested": false
  }
  ```
* **Response Paths:**
  * `201 Created (100% COD Confirmed)`:
    ```json
    {
      "order_number": "ORD-2026-10482",
      "status": "CONFIRMED",
      "payment_status": "UNPAID",
      "cod_amount_collectible_paisa": 233000,
      "estimated_delivery": "2026-10-21T18:00:00.000Z"
    }
    ```
  * `201 Created (Payment Redirect Required)`:
    ```json
    {
      "order_number": "ORD-2026-10483",
      "status": "PENDING_PAYMENT",
      "payment_redirect_url": "https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?Q=pay&SESSIONKEY=...",
      "payable_paisa": 8000
    }
    ```
  * `403 Forbidden`: `{"error": {"code": "ERR_COD_BLACKLISTED", "message": "100% COD disallowed due to 2+ returns in 12 months. Advance delivery fee required."}}`

---

### 6.2 Customer Order Tracking & History
* **Endpoint:** `GET /api/v1/orders` | `GET /api/v1/orders/:orderNumber`
* **Auth Requirement:** **CUSTOMER**
* **Response Paths:**
  * `200 OK`: Returns order details, courier live tracking URL, pre-order milestones, and assigned Seal IDs.

---

### 6.3 Customer Order Cancellation
* **Endpoint:** `POST /api/v1/orders/:orderNumber/cancel`
* **Auth Requirement:** **CUSTOMER**
* **Request Body:** `{"reason": "Ordered by mistake"}`
* **Response Paths:**
  * `200 OK`: `{"success": true, "order_status": "CANCELLED", "refund_eligible": true}`
  * `403 Forbidden`: `{"error": {"code": "ERR_CANCELLATION_DISALLOWED", "message": "Pre-order has reached SOURCED_IN_TRANSIT; deposit is non-refundable."}}`

---

## 7. Payments & SSLCommerz Integration (`/api/v1/payments`)

### 7.1 Asynchronous IPN Webhook Receiver
* **Endpoint:** `POST /api/v1/payments/sslcommerz/ipn`
* **Auth Requirement:** **PUBLIC (SSLCommerz IP Whitelisted + Signature Guard)**
* **Description:** Verifies MD5 `verify_sign` against Store Password. Queries SSLCommerz Order Validation API via server-to-server HTTPS. In one transaction: flips transaction to `PAID`, commits stock, transitions order, and posts journal entry.
* **Request Body:** Form URL-Encoded: `tran_id, val_id, amount, card_type, store_amount, verify_sign...`
* **Response Paths:**
  * `200 OK`: `{"status": "IPN_PROCESSED_SUCCESSFULLY"}`
  * `400 Bad Request`: `{"error": "INVALID_SIGNATURE_HASH"}`

---

### 7.2 Hosted Payment Success Browser Redirect
* **Endpoint:** `POST /api/v1/payments/sslcommerz/success`
* **Auth Requirement:** **PUBLIC (Browser Cross-Site POST)**
* **Description:** Validates payment idempotently and issues HTTP 303 Redirect to customer's order confirmation page.
* **Response Paths:**
  * `303 See Other`: `Location: /bn/account/orders/ORD-2026-10483?status=paid`

---

## 8. Cryptographic Seal Verification Portal (`/api/v1/verify`)

### 8.1 Lookup Seal Authenticity
* **Endpoint:** `GET /api/v1/verify/:sealId`
* **Auth Requirement:** **PUBLIC (Rate limited: 5/min/device, 60/min/IP)**
* **Description:** Public portal lookup. Validates Crockford Base32 token. Checks 24h clone anomaly threshold ($\ge 5$ devices across $\ge 2$ districts).
* **Parameters:** `sealId` (e.g., `NCA-4K9W-8M2P`)
* **Headers:** Cookie `nca_did=<uuid>`
* **Response Paths:**
  * `200 OK (Authentic & Valid)`:
    ```json
    {
      "is_valid": true,
      "seal_id": "NCA-4K9W-8M2P",
      "product_tier": "AUTHENTIC",
      "product": {
        "title_en": "UGREEN Nexode 65W GaN Fast Charger",
        "title_bn": "ইউগ্রিন নেক্সোড ৬৫ ওয়াট গ্যান ফাস্ট চার্জার",
        "brand_name": "UGREEN",
        "image_url": "https://cdn.ncamart.com/products/ugreen-65w-front.webp"
      },
      "oem_manufacturer_serial": "UG-SN-20260981729",
      "qc_verified_at": "2026-10-20T08:30:00.000Z",
      "warranty": {
        "status": "ACTIVE",
        "warranty_days_total": 730,
        "expires_at": "2028-10-20T08:30:00.000Z",
        "coverage_type": "OFFICIAL_DISTRIBUTOR_REPLACEMENT"
      },
      "is_clone_anomaly": false
    }
    ```
  * `200 OK (Counterfeit / Cloned Alert)`:
    ```json
    {
      "is_valid": false,
      "seal_id": "NCA-4K9W-8M2P",
      "warning": "SECURITY_CLONE_ANOMALY_DETECTED",
      "message": "Warning: This seal has been scanned by multiple devices across different districts in Bangladesh within 24 hours. Contact NCAMart Support immediately."
    }
    ```
  * `404 Not Found`: `{"is_valid": false, "message": "Invalid Seal ID. Check label or enter without spaces."}`

---

## 9. Showroom POS & Counter Operations (`/api/v1/pos`)

### 9.1 Verify Customer Pickup PIN
* **Endpoint:** `POST /api/v1/pos/pickup/verify-pin`
* **Auth Requirement:** **SHOWROOM_POS_STAFF**
* **Request Body:**
  ```json
  {
    "order_number": "ORD-2026-10482",
    "pickup_pin": "849201"
  }
  ```
* **Response Paths:**
  * `200 OK`:
    ```json
    {
      "valid": true,
      "order": {
        "order_number": "ORD-2026-10482",
        "customer_name": "Rahim Ahmed",
        "phone_masked": "017****5678",
        "payment_status": "PAID",
        "items": [
          { "sku_code": "UGR-65W-BLK", "title": "UGREEN 65W GaN", "seal_id": "NCA-4K9W-8M2P" }
        ]
      }
    }
    ```
  * `401 Unauthorized`: `{"error": {"code": "ERR_INVALID_PIN", "message": "Incorrect PIN. 2 attempts remaining."}}`

---

### 9.2 Complete Pickup Handover
* **Endpoint:** `POST /api/v1/pos/pickup/handover`
* **Auth Requirement:** **SHOWROOM_POS_STAFF**
* **Request Body:**
  ```json
  {
    "order_id": "c4918a22-3819-4b62-8172-108291a92847",
    "customer_inspected_on_bench": true,
    "signed_handover_slip": true
  }
  ```
* **Response Paths:**
  * `200 OK`: Triggers `DELIVERED_COUNTER`, recognizes revenue in ledger, activates warranty start date.

---

### 9.3 Walk-In POS Sale
* **Endpoint:** `POST /api/v1/pos/walk-in-sale`
* **Auth Requirement:** **SHOWROOM_POS_STAFF**
* **Request Body:**
  ```json
  {
    "customer_phone": "+8801712345678",
    "items": [
      { "sku_id": "sku_ugr_65w_black", "seal_id": "NCA-4K9W-8M2P", "quantity": 1 }
    ],
    "payment_mode": "CASH",
    "paid_amount_paisa": 250000
  }
  ```
* **Response Paths:**
  * `201 Created`: Returns receipt data, prints thermal slip, updates physical showroom balance.

---

## 10. Field Runner PWA & Local Sourcing (`/api/v1/runner`)

### 10.1 Get Sourcing Tasks (PII Masked)
* **Endpoint:** `GET /api/v1/runner/tasks`
* **Auth Requirement:** **FIELD_RUNNER**
* **Response Paths:**
  * `200 OK`:
    ```json
    {
      "tasks": [
        {
          "task_number": "RUN-20261020-0042",
          "sku_code": "NCA-PRO-65W",
          "product_title": "NCA Pro 65W GaN Charger",
          "quantity": 2,
          "target_stall": {
            "stall_number": "Shop #104, 2nd Floor",
            "market_name": "SUNDARBAN_SQUARE",
            "proprietor_name": "Al-Amin Traders"
          },
          "max_authorized_budget_paisa": 200000,
          "status": "DISPATCHED"
        }
      ]
    }
    ```

---

### 10.2 Sync Offline Purchase (Idempotent)
* **Endpoint:** `POST /api/v1/runner/tasks/:taskId/sync-purchase`
* **Auth Requirement:** **FIELD_RUNNER**
* **Headers:** `X-Client-Mutation-Id: <UUIDv4>`
* **Request Body:**
  ```json
  {
    "client_mutation_id": "992182ab-2819-4829-8819-108291829104",
    "actual_cost_paisa": 98000,
    "payment_mode": "CASH_FLOAT",
    "float_session_id": "flt_sess_20261020_01",
    "paper_receipt_photo_url": "https://cdn.ncamart.com/receipts/rec_991823.webp"
  }
  ```
* **Response Paths:**
  * `200 OK`: `{"success": true, "status": "PURCHASED", "mutation_recorded": true}`

---

### 10.3 Request Price Variance Override
* **Endpoint:** `POST /api/v1/runner/tasks/:taskId/request-override`
* **Auth Requirement:** **FIELD_RUNNER**
* **Description:** Used when stall quote exceeds base cost by $> 7\%$. Sends real-time SSE alert to Sourcing Manager.
* **Request Body:**
  ```json
  {
    "quoted_cost_paisa": 108000,
    "reason": "Wholesaler raised price due to import shortage"
  }
  ```
* **Response Paths:**
  * `200 OK`: `{"status": "PRICE_EXCEEDED_PENDING", "message": "Override request submitted to Sourcing Manager"}`

---

## 11. QC Testing & Thermal Sealing (`/api/v1/qc`)

### 11.1 Submit QC Test Checklist
* **Endpoint:** `POST /api/v1/qc/inspect`
* **Auth Requirement:** **QC_TECHNICIAN**
* **Request Body:**
  ```json
  {
    "sku_id": "sku_ugr_65w_black",
    "order_id": "ord_uuid_88129",
    "oem_manufacturer_serial": "UG-SN-20260981729",
    "checklist": {
      "voltage_reading": 5.18,
      "cable_resistance_ohm": 0.08,
      "physical_integrity_check": true,
      "firmware_verified": true
    },
    "passed": true,
    "tester_notes": "Passed Type-C PD handshake test"
  }
  ```
* **Response Paths:**
  * `201 Created`:
    ```json
    {
      "qc_record_id": "qc_rec_99812",
      "passed": true,
      "mint_seal_eligible": true
    }
    ```

---

### 11.2 Mint & Print Crockford Base32 Seal
* **Endpoint:** `POST /api/v1/qc/mint-seal`
* **Auth Requirement:** **QC_TECHNICIAN**
* **Description:** Generates CSPRNG Crockford Base32 ID (`NCA-XXXX-XXXX`), saves to database, and returns raw TSPL/ZPL stream for TSC thermal printer.
* **Request Body:**
  ```json
  {
    "qc_record_id": "qc_rec_99812",
    "sku_id": "sku_ugr_65w_black",
    "order_id": "ord_uuid_88129"
  }
  ```
* **Response Paths:**
  * `200 OK`:
    ```json
    {
      "seal_id": "NCA-4K9W-8M2P",
      "tspl_stream": "SIZE 50 mm, 30 mm\r\nGAP 2 mm, 0 mm\r\nTEXT 50,50,\"3\",0,1,1,\"NCAMart Verified\"\r\nBARCODE 50,100,\"128\",50,1,0,2,2,\"NCA-4K9W-8M2P\"\r\nPRINT 1\r\n",
      "status": "PRINTED"
    }
    ```

---

### 11.3 Void Damaged Label
* **Endpoint:** `POST /api/v1/qc/void-seal`
* **Auth Requirement:** **QC_TECHNICIAN (Requires GODOWN_MANAGER approval if re-printing)**
* **Request Body:**
  ```json
  {
    "seal_id": "NCA-4K9W-8M2P",
    "reason": "PRINTER_JAM"
  }
  ```
* **Response Paths:**
  * `200 OK`: `{"voided": true, "audit_logged": true}`

---

## 12. Dispatch & Courier Logistics (`/api/v1/logistics`)

### 12.1 Get Packing Dispatch Queue
* **Endpoint:** `GET /api/v1/logistics/dispatch-queue`
* **Auth Requirement:** **DISPATCH_STAFF**
* **Description:** Accesses godown packaging station. Returns full unmasked consignee shipping PII.

---

### 12.2 Book Courier Consignment
* **Endpoint:** `POST /api/v1/logistics/book-consignment`
* **Auth Requirement:** **DISPATCH_STAFF / WORKER**
* **Request Body:**
  ```json
  {
    "order_id": "ord_uuid_88129",
    "courier_partner": "STEADFAST",
    "package_weight_grams": 450
  }
  ```
* **Response Paths:**
  * `200 OK`:
    ```json
    {
      "consignment_id": "cs_stf_99812",
      "tracking_code": "STF-20261020-0091",
      "expected_cod_paisa": 233000,
      "shipping_label_url": "https://cdn.ncamart.com/labels/stf_99812.pdf"
    }
    ```

---

### 12.3 Courier Webhook Feeds
* **Endpoint:** `POST /api/v1/logistics/webhooks/:courier` (e.g. `steadfast`, `pathao`, `redx`)
* **Auth Requirement:** **PUBLIC (Secured with Courier Secret Token)**
* **Description:** Normalizes courier statuses into `DELIVERED`, `PARTIALLY_DELIVERED`, `RTO_IN_TRANSIT`, etc.

---

## 13. Warranty, Returns & RMA (`/api/v1/rma`)

### 13.1 Request Presigned Video Upload URL (Cloudflare R2)
* **Endpoint:** `POST /api/v1/rma/upload-url`
* **Auth Requirement:** **CUSTOMER**
* **Description:** Issues direct S3/R2 presigned multipart URL for unboxing video ($\le 300\text{MB}$, $\le 3\text{ minutes}$).
* **Request Body:**
  ```json
  {
    "file_name": "unboxing_order_10482.mp4",
    "file_size_bytes": 145000000,
    "content_type": "video/mp4"
  }
  ```
* **Response Paths:**
  * `200 OK`:
    ```json
    {
      "presigned_upload_url": "https://ncamart-media.r2.cloudflarestorage.com/rma/videos/vid_8812.mp4?X-Amz-Signature=...",
      "r2_key": "rma/videos/vid_8812.mp4",
      "expires_in_seconds": 900
    }
    ```

---

### 13.2 Submit Warranty Claim
* **Endpoint:** `POST /api/v1/rma/claims`
* **Auth Requirement:** **CUSTOMER**
* **Request Body:**
  ```json
  {
    "seal_id": "NCA-4K9W-8M2P",
    "order_id": "ord_uuid_88129",
    "issue_description": "Device stopped charging after 3 days. Port feels loose.",
    "unboxing_video_r2_key": "rma/videos/vid_8812.mp4",
    "is_doa": false
  }
  ```
* **Response Paths:**
  * `201 Created`:
    ```json
    {
      "claim_number": "RMA-2026-0038",
      "claim_stage": "INTAKE",
      "message": "Claim submitted. Support will review video within 1 business hour."
    }
    ```

---

### 13.3 Support Claim Adjudication
* **Endpoint:** `POST /api/v1/rma/claims/:claimNumber/adjudicate`
* **Auth Requirement:** **CUSTOMER_SUPPORT**
* **Request Body:**
  ```json
  {
    "decision": "APPROVED_FOR_RETURN",
    "notes": "Video verified. Factory seal intact. Approving reverse pickup."
  }
  ```
* **Response Paths:**
  * `200 OK`: Transitions stage to `REVERSE_PICKUP` and books courier return.

---

## 14. Finance, In-House Ledger & Settlements (`/api/v1/finance`)

### 14.1 Issue Runner Cash Float Session
* **Endpoint:** `POST /api/v1/finance/float/issue`
* **Auth Requirement:** **FINANCE_OFFICER**
* **Request Body:**
  ```json
  {
    "runner_staff_id": "stf_runner_05",
    "issued_float_paisa": 2000000
  }
  ```
* **Response Paths:**
  * `201 Created`: `{"float_session_id": "flt_sess_20261020_01", "status": "OPEN"}`

---

### 14.2 Reconcile Courier COD Payout CSV
* **Endpoint:** `POST /api/v1/finance/reconciliation/courier-csv`
* **Auth Requirement:** **FINANCE_OFFICER**
* **Description:** Matches courier CSV lines against `courier_shipments.expected_cod_paisa`.
* **Request Body:** Multipart Form (`courier_partner`, `csv_file`)
* **Response Paths:**
  * `200 OK`:
    ```json
    {
      "matched_consignments": 142,
      "short_paid_exceptions": [
        { "tracking_code": "STF-99812", "expected_paisa": 233000, "received_paisa": 220000, "variance_paisa": 13000 }
      ],
      "missing_exceptions_older_7d": 2,
      "total_remitted_paisa": 32900000
    }
    ```

---

### 14.3 Execute Customer Refund
* **Endpoint:** `POST /api/v1/finance/refunds/execute`
* **Auth Requirement:** **CUSTOMER_SUPPORT ($\le ৳1{,}000$) | FINANCE_OFFICER ($\le ৳20{,}000$) | SUPER_ADMIN ($> ৳20{,}000$)**
* **Request Body:**
  ```json
  {
    "order_id": "ord_uuid_88129",
    "amount_paisa": 250000,
    "method": "SSLCOMMERZ_API",
    "reason": "Defective item RMA refund"
  }
  ```
* **Response Paths:**
  * `200 OK`: Posts balanced journal entry ($\sum \text{Debit} = \sum \text{Credit}$), triggers Class A notification.

---

### 14.4 Real-Time Trial Balance & P&L
* **Endpoint:** `GET /api/v1/finance/ledger/trial-balance`
* **Auth Requirement:** **FINANCE_OFFICER**
* **Response Paths:**
  * `200 OK`:
    ```json
    {
      "as_of_date": "2026-10-20T16:00:00.000Z",
      "accounts": [
        { "code": "1010", "name": "City Bank Corporate Operating", "debit_paisa": 145000000, "credit_paisa": 0 },
        { "code": "1110", "name": "Courier COD Receivable", "debit_paisa": 4820000, "credit_paisa": 0 },
        { "code": "4000", "name": "Sales Revenue", "debit_paisa": 0, "credit_paisa": 149820000 }
      ],
      "total_debits_paisa": 149820000,
      "total_credits_paisa": 149820000,
      "is_balanced": true
    }
    ```

---

### 14.5 Download NBR Mushak 6.3 Digital Tax Invoice
* **Endpoint:** `GET /api/v1/finance/invoices/:orderId/mushak-6-3`
* **Auth Requirement:** **CUSTOMER (Own Order) | FINANCE_OFFICER**
* **Response Paths:**
  * `200 OK`: Returns signed Cloudflare R2 download URL for PDF with gapless serial.

---

## 15. Admin Governance & Catalog Management (`/api/v1/admin`)

### 15.1 Create Catalog Draft Product
* **Endpoint:** `POST /api/v1/admin/catalog/products`
* **Auth Requirement:** **CATALOG_MANAGER**
* **Request Body:**
  ```json
  {
    "title_en": "HIKMICRO PocketE Thermal Camera",
    "title_bn": "হিকমাইক্রো পকেটই থার্মাল ক্যামেরা",
    "slug": "hikmicro-pockete-thermal-camera",
    "category_id": "cat_thermal_cameras",
    "product_tier": "AUTHENTIC",
    "brand_name": "HIKMICRO",
    "btrc_status": "PENDING",
    "skus": [
      {
        "sku_code": "HIK-POCKE-01",
        "fulfillment_type": "PRE_ORDER",
        "regular_price_paisa": 4800000,
        "max_counter_sourcing_budget_paisa": 3800000,
        "warranty_days": 365,
        "warranty_type": "OFFICIAL_DISTRIBUTOR"
      }
    ]
  }
  ```
* **Response Paths:**
  * `201 Created`: `{"product_id": "prod_hik_01", "status": "DRAFT"}`

---

### 15.2 Publish Product (Four-Eyes Approval & BTRC Guard)
* **Endpoint:** `POST /api/v1/admin/catalog/products/:id/publish`
* **Auth Requirement:** **SUPER_ADMIN**
* **Description:** Enforces BTRC clearance validation. If category requires BTRC, blocks publish if `btrc_status != 'APPROVED'`.
* **Response Paths:**
  * `200 OK`: `{"success": true, "is_published": true}`
  * `412 Precondition Failed`: `{"error": {"code": "ERR_BTRC_CLEARANCE_REQUIRED", "message": "Product has wireless RF features. Approved BTRC certificate code required before publishing."}}`

---

## 16. Security & Audit Trail (`/api/v1/admin/security`)

### 16.1 Cloned Seal Alert Incident Queue
* **Endpoint:** `GET /api/v1/admin/security/clone-alerts`
* **Auth Requirement:** **SUPER_ADMIN**
* **Response Paths:**
  * `200 OK`:
    ```json
    {
      "alerts": [
        {
          "seal_id": "NCA-4K9W-8M2P",
          "distinct_devices_count": 6,
          "distinct_districts": ["Dhaka", "Chittagong", "Sylhet"],
          "total_scans_24h": 14,
          "flagged_at": "2026-10-20T14:15:00.000Z"
        }
      ]
    }
    ```

---

### 16.2 Immutable Audit Trail Verification
* **Endpoint:** `GET /api/v1/admin/security/audit-trail`
* **Auth Requirement:** **SUPER_ADMIN**
* **Response Paths:**
  * `200 OK`: Returns SHA-256 hash-chained staff operational logs with verification that `current_audit_hash == SHA256(prev_audit_hash + event_data)`.

---

## 17. Authentication & RBAC Access Matrix Summary

| API Module | Endpoint Path | Method | Auth Required | Authorized Roles / Actors |
| :--- | :--- | :---: | :---: | :--- |
| **Auth** | `/api/v1/auth/otp/send` | `POST` | ❌ No | Public (Rate Limited) |
| **Auth** | `/api/v1/auth/otp/verify` | `POST` | ❌ No | Public |
| **Auth** | `/api/v1/auth/staff/login` | `POST` | ❌ No | Staff Members |
| **Auth** | `/api/v1/auth/logout` | `POST` | ✅ Yes | Any Logged-In User |
| **Auth** | `/api/v1/auth/sessions` | `GET/DELETE` | ✅ Yes | Session Owner |
| **Customer** | `/api/v1/customer/profile` | `GET/PUT` | ✅ Yes | `CUSTOMER` |
| **Customer** | `/api/v1/customer/addresses` | `GET/POST` | ✅ Yes | `CUSTOMER` |
| **Customer** | `/api/v1/customer/warranties`| `GET` | ✅ Yes | `CUSTOMER` |
| **Catalog** | `/api/v1/catalog/products` | `GET` | ❌ No | Public |
| **Catalog** | `/api/v1/catalog/compare/:id`| `GET` | ❌ No | Public |
| **Catalog** | `/api/v1/catalog/search` | `GET` | ❌ No | Public |
| **Cart** | `/api/v1/cart/validate` | `POST` | ❌ No | Public / Guest / Customer |
| **Cart** | `/api/v1/cart/reserve` | `POST` | ❌ No | Public / Guest / Customer |
| **Orders** | `/api/v1/orders/checkout` | `POST` | ✅ Yes | `CUSTOMER` (or OTP Verified Guest) |
| **Orders** | `/api/v1/orders` | `GET` | ✅ Yes | `CUSTOMER` (Own Orders) |
| **Orders** | `/api/v1/orders/:id/cancel` | `POST` | ✅ Yes | `CUSTOMER` (Own Orders) |
| **Payments** | `/api/v1/payments/sslcommerz/ipn`| `POST`| ❌ No | SSLCommerz IP Whitelisted |
| **Payments** | `/api/v1/payments/sslcommerz/success`| `POST`| ❌ No | Public (Browser POST Redirect) |
| **Verify** | `/api/v1/verify/:sealId` | `GET` | ❌ No | Public (5/min/device, 60/min/IP) |
| **POS** | `/api/v1/pos/pickup/verify-pin` | `POST` | ✅ Yes | `SHOWROOM_POS_STAFF` |
| **POS** | `/api/v1/pos/pickup/handover` | `POST` | ✅ Yes | `SHOWROOM_POS_STAFF` |
| **POS** | `/api/v1/pos/walk-in-sale` | `POST` | ✅ Yes | `SHOWROOM_POS_STAFF` |
| **POS** | `/api/v1/pos/drawer/open` | `POST` | ✅ Yes | `SHOWROOM_POS_STAFF` |
| **POS** | `/api/v1/pos/drawer/close` | `POST` | ✅ Yes | `SHOWROOM_POS_STAFF` |
| **Runner** | `/api/v1/runner/tasks` | `GET` | ✅ Yes | `FIELD_RUNNER` |
| **Runner** | `/api/v1/runner/tasks/:id/sync-purchase`| `POST`| ✅ Yes | `FIELD_RUNNER` |
| **Runner** | `/api/v1/runner/tasks/:id/request-override`| `POST`| ✅ Yes | `FIELD_RUNNER` |
| **Runner** | `/api/v1/runner/float/return` | `POST` | ✅ Yes | `FIELD_RUNNER` |
| **QC** | `/api/v1/qc/inspect` | `POST` | ✅ Yes | `QC_TECHNICIAN` |
| **QC** | `/api/v1/qc/mint-seal` | `POST` | ✅ Yes | `QC_TECHNICIAN` |
| **QC** | `/api/v1/qc/void-seal` | `POST` | ✅ Yes | `QC_TECHNICIAN`, `GODOWN_MANAGER` |
| **Logistics**| `/api/v1/logistics/dispatch-queue` | `GET` | ✅ Yes | `DISPATCH_STAFF` |
| **Logistics**| `/api/v1/logistics/book-consignment` | `POST` | ✅ Yes | `DISPATCH_STAFF`, Internal Worker |
| **Logistics**| `/api/v1/logistics/webhooks/:courier` | `POST` | ❌ No | Courier Secret Guarded |
| **RMA** | `/api/v1/rma/upload-url` | `POST` | ✅ Yes | `CUSTOMER` |
| **RMA** | `/api/v1/rma/claims` | `POST` | ✅ Yes | `CUSTOMER` |
| **RMA** | `/api/v1/rma/claims/:id/adjudicate` | `POST` | ✅ Yes | `CUSTOMER_SUPPORT` |
| **RMA** | `/api/v1/rma/claims/:id/inspect` | `POST` | ✅ Yes | `QC_TECHNICIAN` |
| **Finance** | `/api/v1/finance/float/issue` | `POST` | ✅ Yes | `FINANCE_OFFICER` |
| **Finance** | `/api/v1/finance/reconciliation/courier-csv` | `POST` | ✅ Yes | `FINANCE_OFFICER` |
| **Finance** | `/api/v1/finance/refunds/execute` | `POST` | ✅ Yes | Limit: Support $\le 1\text{k}$, Finance $\le 20\text{k}$, Admin $> 20\text{k}$ |
| **Finance** | `/api/v1/finance/ledger/trial-balance` | `GET` | ✅ Yes | `FINANCE_OFFICER`, `SUPER_ADMIN` |
| **Admin** | `/api/v1/admin/catalog/products` | `POST/PUT` | ✅ Yes | `CATALOG_MANAGER` |
| **Admin** | `/api/v1/admin/catalog/products/:id/publish`| `POST` | ✅ Yes | `SUPER_ADMIN` (Four-Eyes Approval) |
| **Admin** | `/api/v1/admin/coupons` | `POST` | ✅ Yes | `CATALOG_MANAGER` (Draft), `SUPER_ADMIN` (Activate) |
| **Security** | `/api/v1/admin/security/clone-alerts` | `GET` | ✅ Yes | `SUPER_ADMIN` |
| **Security** | `/api/v1/admin/security/audit-trail` | `GET` | ✅ Yes | `SUPER_ADMIN` |
