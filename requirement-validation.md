# Requirements Validation & Technical Gap Analysis — NCAMart

**Document Type:** Senior Product Analyst & Software Architect Specification  
**Target Document:** [PRD.md](file:///g:/My%20Drive/Nawabpur%20Complex%20Accessories/ncamart/PRD.md) (v1.2)  
**Foundation Document:** [prd-analysis.md](file:///g:/My%20Drive/Nawabpur%20Complex%20Accessories/ncamart/prd-analysis.md)  
**Author / Role:** Senior Product Analyst & Systems Architect  
**Date:** 2026-10-14  
**Status:** Complete Audit & Production-Readiness Specification  

---

## Executive Overview

This document performs a granular technical and business requirements audit of **[PRD.md](file:///g:/My%20Drive/Nawabpur%20Complex%20Accessories/ncamart/PRD.md)** across **eight critical dimensions**:
1. **Missing Flows** (Unmapped user and operational lifecycles)
2. **Edge Cases** (State collisions, concurrent anomalies, boundary conditions)
3. **Error Handling** (Timeouts, webhook dropped events, hardware printer failures)
4. **Security** (Cryptographic anti-counterfeiting, rate limiting, anti-fraud)
5. **Validation Rules** (Data schemas, input sanitization, financial constraints)
6. **Permission Matrix (RBAC)** (Granular role-based capability boundaries)
7. **Notification Matrix** (Multi-channel event orchestration, SLAs, quiet hours)
8. **Exceptions & Escalation Pathways** (Supply chain defaults, courier damage, RMA disputes)

---

## 1. Missing Flows (Unmapped Lifecycles)

While PRD v1.2 outlines five core flows, the following **six mission-critical lifecycles** are completely absent or partially documented and must be engineered for production operations:

```
                                  ┌───────────────────────────────┐
                                  │   Unmapped Operational Flows   │
                                  └───────────────┬───────────────┘
         ┌───────────────────┬────────────────────┼───────────────────┬───────────────────┐
         │                   │                    │                   │                   │
  [Flow A: RTO /      [Flow B: Pre-Order   [Flow C: Reverse    [Flow D: In-Store   [Flow E: Supplier
   Doorstep Reject]    Abandonment &        Logistics (Courier  Showroom Counter    Re-quote & Price
                       Forfeiture]          Pickup to Godown]   Walk-in Pickup]     Escalation]
```

### Flow A: Failed Delivery & Return-to-Origin (RTO) Lifecycle
* **Trigger:** Customer refuses parcel at doorstep or courier attempts 3 failed calls over 48 hours.
* **Missing Steps in PRD:**
  1. Courier API dispatches `DELIVERY_FAILED_RTO_INITIATED` webhook.
  2. System flags Customer record with `rto_count += 1`. If `rto_count >= 2`, customer profile is marked `HIGH_RISK_COD_BLOCKED`.
  3. Reverse parcel returns to Nawabpur Godown within 3–5 business days.
  4. Godown QC technician inspects parcel exterior:
     - **Intact Original Seal:** Returned item restocked in Drop-and-Pack inventory or returned to vendor for credit.
     - **Damaged / Tampered Seal:** Formal transit damage claim lodged against courier with inspection photos.
  5. Accounting registers loss of outbound + return delivery fees. Advance delivery fee collected initially is credited to courier freight expense.

### Flow B: Pre-Order Customer Default & Inventory Forfeiture Flow
* **Trigger:** Pre-order item arrives at Nawabpur Godown, but customer fails to pay balance within 7 calendar days.
* **Missing Steps in PRD:**
  1. **Day 1 (Arrival):** Automated SMS/WhatsApp: *"Your item has passed QC. Balance due: ৳XX,XXX. Ready for dispatch."*
  2. **Day 4 (Warning):** Automated SMS/Call Alert: *"Notice: 72 hours remaining to settle balance before order cancellation."*
  3. **Day 7 (Final Notice):** Support Agent conducts manual phone call verification.
  4. **Day 8 (Forfeiture Trigger):** System automatically marks PreOrder as `DEPOSIT_FORFEITED_CANCELLED`.
  5. Item is automatically listed on storefront as **"In-Stock Flash Deal"** (Ready to ship in Nawabpur) at landed price.
  6. Customer account ledger records non-refundable deposit adjustment per terms of service.

### Flow C: Reverse Logistics (Courier RMA Doorstep Pickup) Flow
* **Trigger:** Support Agent approves a 7-day replacement or DOA claim.
* **Missing Steps in PRD:**
  1. Support Agent triggers `GENERATE_REVERSE_PICKUP` via Steadfast/Pathao API.
  2. Courier runner collects defective unit from customer doorstep with return consignment note.
  3. Customer receives automated tracking link for the return shipment.
  4. Package received at Nawabpur Godown → Barcode scanned into `QC_INSPECTION_QUEUE`.
  5. If defect verified → System triggers automated dispatch of replacement unit within 24 hours.

### Flow D: Showroom Counter Pickup & Inspection Flow
* **Trigger:** Customer selects "Showroom Counter Pickup (Nawabpur Complex)" at checkout.
* **Missing Steps in PRD:**
  1. Order routed to Godown Runner with label `INTERNAL_COUNTER_HOLD`.
  2. Item tested, sealed, and staged in Counter Locker with 6-digit **Pickup PIN**.
  3. Customer arrives at Nawabpur Complex, provides Order ID and Pickup PIN.
  4. Counter Staff opens customer portal POS mode, enters PIN to verify.
  5. Customer tests device on counter test-bench; customer signs physical/digital handover slip.
  6. Order status updated to `DELIVERED_COUNTER` in real-time.

### Flow E: Supplier Spot Price Re-Quote & Counter-Offer Flow
* **Trigger:** Wholesaler quotes higher counter price exceeding the 7% tolerance buffer.
* **Missing Steps in PRD:**
  1. Runner submits counter price via mobile web app.
  2. System calculates net margin; if margin < 15%, app freezes task and pings Sourcing Manager.
  3. Sourcing Manager dashboard shows 3 real-time choices:
     - **Option 1 (Approve Override):** Accept lower margin (strategic customer retention).
     - **Option 2 (Switch Vendor):** Automatically re-route runner to Backup Supplier #2 stall.
     - **Option 3 (Decline & Notify):** System auto-triggers SMS to customer offering alternative SKU or instant refund.

### Flow F: Authentic Distributor Warranty Escalation Flow
* **Trigger:** Customer files warranty claim on Authentic product after 30 days (outside NCAMart 7-day shop window).
* **Missing Steps in PRD:**
  1. Customer submits Seal ID + Manufacturer Serial on `/verify`.
  2. System displays official authorized service center location and phone number.
  3. If customer opts for **"NCAMart Assisted Warranty"**, system generates a transit booking ticket.
  4. NCAMart weekly liaison runner batches units and delivers to distributor service center (e.g., Star Tech, Ryans, Excel Technologies).
  5. Service RMA status synced back to customer portal until repaired unit is returned.

---

## 2. Edge Cases (Boundary Conditions & State Collisions)

| Edge Case ID | Scenario | Root Conflict | Technical & Operational Resolution |
| :--- | :--- | :--- | :--- |
| **EC-01** | **Concurrent Cart Race Condition** | Two customers check out the last in-stock unit of a Drop-and-Pack SKU simultaneously. | Implement a **10-minute temporary inventory reservation lock** via Redis during checkout initiation. If checkout is not completed within 10 minutes, lock is released back to pool. |
| **EC-02** | **Pre-Order Item Cancelled Mid-Transit** | Customer demands deposit refund while item is on an international cargo flight. | Checkout modal explicitly presents an unskippable checkbox: *"Deposit becomes non-refundable once international cargo tracking number is generated."* UI disables cancellation button once status reaches `IN_TRANSIT`. |
| **EC-03** | **Exchange Rate Hyper-Volatility (>8%)** | BDT devalues by 12% against USD between pre-order deposit and arrival. | System triggers a formal **Re-Pricing Approval Ticket**: Customer receives SMS/email with a 48-hour response window. If accepted, balance is adjusted. If rejected, deposit is refunded in full within 3 business days. |
| **EC-04** | **Multiple Seal ID Lookup Anomaly** | A single Seal ID is queried from 15 different IP addresses within 2 hours. | Potential cloned seal / counterfeit incident. The `/verify` portal returns standard product info but flags internal security dashboard: `CLONED_SEAL_SUSPECTED`. Admin investigates immediately. |
| **EC-05** | **Partial Multi-Item Order Stockout** | Order has 2 items: Charger (Available in Sundarban) + Cable (Out of stock across all Stadium stalls). | System prompts Customer Support console: **Partial Dispatch** with customer consent (ships item 1 today, item 2 tomorrow with single delivery fee), OR offers immediate replacement of item 2 with superior tier at equal price. |
| **EC-06** | **Pre-Order Batch Threshold Failure** | A niche thermal camera requires N=5 pre-orders to import, but only 2 customers deposit over 30 days. | If batch threshold is not met within 30 days, system triggers automated notification: customers offered full 100% refund or option to pay an individual expedited import fee. |
| **EC-07** | **Zero-Network / Offline Runner Sourcing** | Runner enters underground basement stalls of Sundarban Square with zero 4G connectivity. | Runner mobile web app must support **PWA Offline Mode** (Service Worker + IndexedDB). Runner can scan vendor receipt and enter purchase price offline; data auto-syncs upon returning to street level. |

---

## 3. Error Handling Architecture

```
                                  ┌───────────────────────────────┐
                                  │   Failure Isolation Matrix    │
                                  └───────────────┬───────────────┘
         ┌───────────────────┬────────────────────┼───────────────────┬───────────────────┐
         │                   │                    │                   │                   │
  [Gateway Drop /     [Courier Webhook    [Thermal Label       [SMS Gateway        [Database Concurrency
   IPN Disconnect]     Failure / Retry]    Printer Failure]     Outage Fallback]    Locking]
```

### 3.1 Payment Gateway Webhook Drops (SSLCommerz IPN Failure)
* **The Problem:** Customer bKash/Card is debited, but customer closes browser before redirect or SSLCommerz IPN webhook fails to reach NCAMart backend.
* **Handling Strategy:**
  1. Every checkout transaction creates a pending transaction record with a unique `TRAN_ID`.
  2. Implement a background **Reconciliation Cron Job** running every 5 minutes querying SSLCommerz Query API (`/validator/api/merchantTransIDvalidationAPI.php`) for all `PENDING` orders older than 10 minutes.
  3. If SSLCommerz returns `VALID` or `VALIDATED`, order is automatically flipped to `PAID` without requiring customer intervention.

### 3.2 Courier API Synchronization Failures
* **The Problem:** Steadfast or Pathao API returns HTTP 500/504 or rate-limit errors during automated bulk parcel generation.
* **Handling Strategy:**
  1. Decouple courier booking from order confirmation using a message queue (BullMQ / RabbitMQ).
  2. Failed courier dispatch calls execute **Exponential Backoff Retry** (Attempts: 1m, 5m, 15m, 30m).
  3. If 4 consecutive retries fail, ticket routes to the Logistics Coordinator dashboard for one-click manual fallback to alternate courier.

### 3.3 Godown Thermal Label Printer Failure (Mid-Print Jam)
* **The Problem:** QC technician approves item, Seal ID is generated in DB, but thermal label printer jams, runs out of ribbon, or ruins the destructive sticker.
* **Handling Strategy:**
  1. A Seal ID cannot be casually re-printed (prevents duplicate sticker injection).
  2. Admin UI provides a dedicated **"Void & Re-Print Sticker"** action.
  3. Technician must select a reason: `PRINTER_JAM`, `RIBBON_TEAR`, or `STICKER_DAMAGED`.
  4. System marks original Seal ID as `STATUS_VOID_PRINT_ERROR` in the immutable audit log and issues a fresh non-sequential Seal ID.

### 3.4 Multi-Channel Notification Failures
* **The Problem:** Primary SMS aggregator (e.g., Greenweb, Reve SMS) experiences gateway timeout.
* **Handling Strategy:**
  1. Circuit Breaker pattern on SMS dispatch.
  2. If SMS API failure rate exceeds 10% over 5 minutes, automatically switch primary route to WhatsApp Business API or secondary SMS gateway.
  3. Critical order milestones (Order Placed, Out for Delivery, Refund) queue in an asynchronous dead-letter queue (DLQ) for guaranteed delivery.

---

## 4. Security & Anti-Fraud Architecture

```
                                  ┌───────────────────────────────┐
                                  │   NCAMart Security Perimeter  │
                                  └───────────────┬───────────────┘
         ┌───────────────────┬────────────────────┼───────────────────┬───────────────────┐
         │                   │                    │                   │                   │
  [Cryptographic      [DDoS & Brute-Force  [PII Masking on     [Collusion & Staff  [SSLCommerz Callback
   Seal Entropy]       Rate Limiting]       Runner Screens]     Audit Trail]        Integrity Validation]
```

### 4.1 Seal ID Cryptographic Entropy
* **Vulnerability:** If Seal IDs are sequential (e.g., `NCA-1001`, `NCA-1002`), fraudsters can easily print fake labels with predicted numbers or scrape warranty data.
* **Implementation Standard:**
  - Formula: `NCA-` + `4 Alphanumeric (Base32)` + `-` + `4 Alphanumeric (Base32)`
  - Example: `NCA-8F2K-9X41`
  - Total combinations: $32^8 \approx 1.09 \times 10^{12}$ (1.09 Trillion permutations).
  - Generated using cryptographically secure pseudorandom number generators (`crypto.randomBytes`).

### 4.2 Endpoint Rate Limiting & Anti-Scraping
| Endpoint | Method | Rate Limit Threshold | Penalty Action |
| :--- | :--- | :--- | :--- |
| `/api/v1/verify` | `POST` / `GET` | Max 5 requests / min per IP | 15-minute temporary IP block + Cloudflare Turnstile CAPTCHA challenge |
| `/api/v1/auth/otp/send` | `POST` | Max 3 requests / 10 min per Phone | 1-hour cooldown period |
| `/api/v1/auth/otp/verify` | `POST` | Max 3 failed attempts per OTP | Invalidate OTP session; require complete re-generation |
| `/api/v1/checkout` | `POST` | Max 10 attempts / hour per User | Flag account for human review |

### 4.3 Sensitive Customer PII Masking on Runner Screens
* **Vulnerability:** Field runners visiting dozens of stalls in Nawabpur have their phones exposed. Displaying full customer names, phone numbers, and home addresses exposes customer data to third-party wholesale merchants.
* **Implementation Standard:**
  - Runner pickup view displays **only**: Order #, Sourcing Item SKU, Quantity, Wholesale Shop Stall #, and Max Purchase Price.
  - Customer shipping addresses and contact details are strictly restricted to the **Packaging & Shipping Station** in the central godown.

### 4.4 Staff Collusion & Internal Theft Prevention
* **Vulnerability:** A rogue technician might print authorized Authentic seals and affix them to uninspected or stolen inventory.
* **Implementation Standard:**
  - Every printed Seal ID requires an active staff session with 2FA.
  - A Seal ID cannot be marked `ACTIVE` without completing the mandatory 3-point QC test checklist fields.
  - System enforces a **Supervisor Sampling Quota**: 5% of all QC-cleared parcels are automatically flagged for random double-inspection by the Godown Manager before handover to couriers.

### 4.5 SSLCommerz Callback Signature Verification
* **Vulnerability:** Malicious actors sending spoofed IPN HTTP POST requests to mark unpaid orders as `PAID`.
* **Implementation Standard:**
  - Backend must validate the IPN payload using SSLCommerz **Store Password** and **MD5 Hash Validation**.
  - Server immediately executes an outbound server-to-server validation call to SSLCommerz Order Validation API before mutating order status in the database.

---

## 5. Validation Rules & Data Integrity Constraints

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Data Validation Schema Standards                      │
├──────────────────────────┬──────────────────────────────────────────────────┤
│ Phone Number (MSISDN)    │ Regex: ^(?:\+8801|01)[3-9]\d{8}$                 │
│ Seal ID Format           │ Regex: ^NCA-[A-Z0-9]{4}-[A-Z0-9]{4}$             │
│ Currency & Pricing       │ Positive decimal(10,2), BDT only, Min: ৳10.00    │
│ Pre-Order Deposit Tier   │ Server-calculated: 10% (Price ≥ 50k), 20% (< 50k)│
│ RMA Attachment Media     │ Format: JPG, PNG, MP4, WebM; Max 15MB total      │
│ Courier Address Schema   │ District, Thana, Area validated against API enum │
└──────────────────────────┴──────────────────────────────────────────────────┘
```

### 5.1 Strict Server-Side Financial Validation
1. **Zero Client-Side Trust:** Selling price, discount amount, deposit requirement, and shipping fees must **never** be accepted from client payloads. The backend calculates total payable amounts directly from database SKU records.
2. **Deposit Calculation Invariant:**
   $$\text{Deposit} = \begin{cases} 
   \text{Price} \times 0.10 & \text{if Price} \ge ৳50,000 \\ 
   \text{Price} \times 0.20 & \text{if Price} < ৳50,000 
   \end{cases}$$
3. **Cart Isolation Invariant:**
   $$\text{Cart Items} \subseteq \{\text{Drop-and-Pack}\} \quad \lor \quad \text{Cart Items} \subseteq \{\text{Pre-Order}\}$$
   A checkout payload containing both types must return `HTTP 422 Unprocessable Entity` with error code `ERR_MIXED_CART_DISALLOWED`.

---

## 6. Granular Role-Based Access Control (RBAC) Matrix

| System Resource / Action | Anonymous Guest | Customer | Field Runner | QC Tech | Showroom POS Staff | Sourcing Manager | Support Agent | Super Admin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Browse Catalog & Comparison** | ✅ Read | ✅ Read | ✅ Read | ✅ Read | ✅ Read | ✅ Read | ✅ Read | ✅ Full |
| **Place Order / Pay Deposit** | ❌ (Req. OTP) | ✅ Create | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Full |
| **Lookup Seal on `/verify`** | ✅ Read | ✅ Read | ✅ Read | ✅ Read | ✅ Read | ✅ Read | ✅ Read | ✅ Full |
| **View Runner Pickup Tasks** | ❌ | ❌ | ✅ Read/Update | ❌ | ❌ | ✅ Read/Assign| ❌ | ✅ Full |
| **Input Wholesale Purchase Price**| ❌ | ❌ | ✅ Input | ❌ | ❌ | ✅ Override | ❌ | ✅ Full |
| **Execute QC Checklist & Log** | ❌ | ❌ | ❌ | ✅ Create | ❌ | ❌ | ❌ | ✅ Full |
| **Generate & Print Seal IDs** | ❌ | ❌ | ❌ | ✅ Execute | ❌ | ❌ | ❌ | ✅ Full |
| **Void Damaged Seal ID** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Approve | ❌ | ✅ Full |
| **Counter POS Checkout** | ❌ | ❌ | ❌ | ❌ | ✅ Execute | ❌ | ❌ | ✅ Full |
| **View Customer PII (Full)** | ❌ | Own profile | ❌ (Masked) | ❌ (Masked)| Counter only | ❌ (Masked)| ✅ Read | ✅ Full |
| **Approve Spot Price Over-Buffer**| ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Approve | ❌ | ✅ Full |
| **Adjudicate RMA Warranty Claim** | ❌ | Own claims | ❌ | ❌ | ❌ | ❌ | ✅ Process | ✅ Full |
| **Issue Financial Refund** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Up to ৳1,000 | ✅ Full |
| **Edit Catalog / Product Tiers** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Full |
| **View Financial & Profit Reports**| ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Full |

---

## 7. Multi-Channel Notification Matrix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   Notification Orchestration Architecture                   │
├──────────────────────────┬───────┬──────────┬───────┬───────────────────────┤
│ Lifecycle Trigger        │  SMS  │ WhatsApp │ Email │ Delivery SLA / Window │
├──────────────────────────┼───────┼──────────┼───────┼───────────────────────┤
│ 1. OTP Verification Code │   ✅  │    —     │   —   │ Real-time (< 15 sec)  │
│ 2. Order Placed (Pre/Drop)│  ✅  │    ✅    │   ✅  │ Instant (< 1 min)     │
│ 3. Advance Fee Payment Conf│ ✅  │    ✅    │   ✅  │ Instant (< 1 min)     │
│ 4. Pre-Order Sourced/Transit│✅  │    ✅    │   ✅  │ 09:00 AM – 09:00 PM   │
│ 5. Pre-Order QC Passed / Arrv│✅  │   ✅    │   ✅  │ Instant               │
│ 6. Out for Delivery Alert│   ✅  │    ✅    │   —   │ Morning of delivery   │
│ 7. Pre-Order Balance Due  │  ✅  │    ✅    │   ✅  │ Day 1, 4, 7 after QC   │
│ 8. RMA Claim Status Update│  ✅  │    ✅    │   ✅  │ Within 2 hours of rev │
│ 9. Cloned Seal Alert (Int)│ Admin │  Admin   │ Admin │ Urgent Real-time (<1m)│
└──────────────────────────┴───────┴──────────┴───────┴───────────────────────┘
```

### Regulatory Compliance on Messaging:
* **BTRC DND (Do Not Disturb) Policy:** No promotional, marketing, or non-transactional messages may be transmitted between **10:00 PM and 08:00 AM**.
* **Transactional Exemption:** OTPs, Delivery Status updates, and RMA urgent notifications are operational transactional messages and may be delivered 24/7.

---

## 8. Exceptions & Escalation Pathways

```
                                  ┌───────────────────────────────┐
                                  │   Escalation Control Matrix   │
                                  └───────────────┬───────────────┘
         ┌───────────────────┬────────────────────┼───────────────────┬───────────────────┐
         │                   │                    │                   │                   │
  [Supplier Batch     [Courier Lost /      [Authorized Service  [Force Majeure /     [Disputed Cosmetic
   QC Rejection]       Damage Claim]        Center Refusal]      Customs Embargo]     RMA Damage]
```

### Exception 1: Wholesale Supplier Batch Defect Failure
* **Condition:** Runner brings a batch of 5 adapters from a Sundarban merchant; 3 units fail the 3-point QC test.
* **Escalation Protocol:**
  1. QC Technician marks items as `BATCH_REJECTED` in portal.
  2. Runner returns entire batch to supplier stall for immediate cash refund or replacement.
  3. Supplier's **Defect Score** automatically degrades. If defect score exceeds 3% over 30 days, supplier is suspended from the runner sourcing list.

### Exception 2: Courier Loss or Severe Transit Damage
* **Condition:** Courier tracking shows package stuck in hub for 7+ days or package delivered with physical crushing.
* **Escalation Protocol:**
  1. Customer submits unboxing video via RMA portal.
  2. NCAMart immediately dispatches a brand-new replacement unit to the customer within 24 hours (Customer must not wait for courier insurance resolution).
  3. Sourcing Manager files a formal freight compensation claim against Steadfast/Pathao with dispatch photos.

### Exception 3: Official Brand Distributor Warranty Refusal (Authentic Tier)
* **Condition:** Authorized service center claims a device cannot be repaired due to unverified distributor serial records.
* **Escalation Protocol:**
  1. NCAMart's **100% Authentic Guarantee SLA** activates: NCAMart assumes full financial responsibility.
  2. Customer is issued an immediate brand-new replacement or 100% store refund within 48 hours.
  3. Sourcing Manager escalates invoice and procurement records directly with the executive distributor account manager.

### Exception 4: Force Majeure & International Cargo Embargo
* **Condition:** International air freight is grounded, or Chittagong/Dhaka customs port faces indefinite strike during a Pre-Order cycle.
* **Escalation Protocol:**
  1. When delay exceeds promised ETA by 7 days, system auto-generates a personalized video/message from Sourcing Director explaining circumstances.
  2. Customers are presented with two self-service choices in their portal:
     - **Choice A:** Maintain priority queue with a complimentary ৳1,000 store voucher credited upon arrival.
     - **Choice B:** Cancel pre-order with an immediate 100% deposit refund processed within 24 hours.

---

## 9. Comprehensive Implementation Action Plan

| Priority | Dimension | Implementation Requirement | Target Milestone |
| :---: | :--- | :--- | :--- |
| **P0** | **Validation** | Enforce Server-Side Cart Isolation (Separate Pre-Order vs. Regular checkout). | Phase 1 (Sprint 1) |
| **P0** | **Security** | Implement Cryptographic Base32 Random Seal ID generator (`NCA-XXXX-XXXX`). | Phase 1 (Sprint 1) |
| **P0** | **Error Handling** | Configure SSLCommerz 5-minute background reconciliation cron job. | Phase 1 (Sprint 2) |
| **P0** | **Permission** | Establish strict Role-Based Access Control (RBAC) with PII masking for field runners. | Phase 1 (Sprint 2) |
| **P1** | **Missing Flow** | Build Failed Delivery / RTO inventory re-stocking and courier cost accounting. | Phase 1 (Sprint 3) |
| **P1** | **Missing Flow** | Build Showroom POS Counter Mode with real-time web inventory lock. | Phase 1 (Sprint 3) |
| **P1** | **Edge Cases** | Integrate Wholesale Spot Price Buffer (5%–7%) with real-time manager approval. | Phase 1 (Sprint 4) |
| **P2** | **Notification** | Orchestrate automated WhatsApp Business milestone messages with BTRC quiet-hour rules. | Phase 1.5 |
| **P2** | **Exception** | Automated Pre-Order Forfeiture trigger and storefront re-listing after 7-day default. | Phase 1.5 |

---

## 10. Conclusion

This Requirements Validation document establishes the technical, operational, and security guardrails necessary to transform **NCAMart** from a product concept into a resilient, enterprise-grade e-commerce engine. By anticipating edge cases, eliminating single points of failure, securing customer PII, and automating multi-channel notifications, the platform is fully fortified for technical architecture and production development.
