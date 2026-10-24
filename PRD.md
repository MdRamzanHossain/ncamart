# Product Requirements Document (PRD) — NCAMart

**Document Version:** 1.4  
**Status:** Approved for Development & Technical Architecture  
**Last Updated:** 2026-10-15  
**Owner:** NCAMart Product & Engineering Team  
**Domain:** [ncamart.com](https://ncamart.com)  
**Based on:** [idea.md](./idea.md), [prd-analysis.md](./prd-analysis.md), [requirement-validation.md](./requirement-validation.md) & [architechture.md](./architechture.md)  

### Change Log
| Version | Date | Changes |
| :--- | :--- | :--- |
| 1.0 | — | Initial concept draft. |
| 1.1 | 2026-10-14 | Standardized deposit to 10–20%. Set strict no-replica policy for Budget Tier. Currency fixed to BDT only. Added initial operational sections. |
| 1.2 | 2026-10-14 | Incorporated Product & Business Analysis: Confirmed tiered deposit (10%/20%), SSLCommerz gateway, advance delivery fee on COD for first-time buyers, and resolved open questions. |
| 1.3 | 2026-10-14 | **Complete Technical Requirements Validation:** Integrated 6 missing operational flows (RTO, Pre-Order Forfeiture, Reverse Logistics Courier RMA, Showroom PIN Pickup, Supplier Re-quote, Distributor Warranty); 7 Edge Cases (Redis cart locks, in-transit cancellation locks, cloned seal detection, partial stockout, offline runner PWA); Full Error Handling architecture (SSLCommerz reconciliation cron, courier exponential backoff retry, thermal printer void protocol); Cryptographic Base32 Seal ID entropy; Granular 8-Role RBAC Matrix with runner PII masking; Multi-Channel Notification Matrix with BTRC quiet-hour compliance; and 5 Exception/Escalation Pathways. |
| 1.4 | 2026-10-15 | **Architecture Review Resolution:** Progressive (no-cliff) pre-order deposit; pre-order balance COD cap; physical vs. virtual inventory model with Postgres-backed reservations (§3.11); order & payment state machines (§3.12); in-house double-entry finance ledger, courier COD & gateway settlement reconciliation, runner cash float (§3.13); refunds, store credit & coupons (§3.14); catalog governance (§3.15); search, reviews & engagement (§3.16); analytics & marketing feeds (§3.17); data protection & device policy (§3.18); showroom walk-in sales; Crockford Base32 Seal IDs; CGNAT-safe `/verify` rate limiting & clone detection; unified notification classes; RBAC expanded to 10 staff roles; RMA video upload limits; phone-number recycling & guest-merge rules; warranty start definition; rolling 12-month RTO count; VAT-inclusive pricing; Next.js full-stack decision. Conflicting values in requirement-validation.md are superseded (§13). |

---

## 1. Project Overview

### 1.1 Executive Summary
**NCAMart** is a specialized e-commerce and retail platform anchored in the Nawabpur Complex, directly adjacent to Sundarban Square, Stadium Market, and Patuatuli in Dhaka, Bangladesh. The regional tech and utility electronics market is plagued by pervasive counterfeits, misleading branding, grey-market speculation, and a refusal by merchants to honor warranties.

NCAMart solves this trust deficit through a core value proposition of **Radical Transparency**:
- Every catalog SKU is explicitly segmented into **100% Authentic** or **Budget Smart (Tested OEM)**, backed by visual badges and side-by-side spec comparisons. No counterfeit branding or replicas are permitted.
- An **In-House QC & Serial Verification Engine**, reinforced by physical **Destructive Tamper-Evident VOID Seals** and cryptographically randomized Seal IDs queried via `/verify`.
- An **On-Demand Pre-Order System** for specialized engineering tools and high-end smart gadgets, requiring a progressive **10%–20% advance deposit**, eliminating dead-stock risk.
- Fast **Drop-and-Pack** local fulfillment, utilizing hyper-local runner proximity to adjacent wholesale markets to ship orders same-day or next-day without warehouse inventory carrying costs.

### 1.2 Core Business Objectives
1. **Eliminate Customer Mistrust:** Establish an unshakeable reputation for honesty by removing ambiguity between genuine branded gear and budget alternatives through clear badges, upfront specs, and online serial verification.
2. **Zero Dead-Stock on Niche Tech:** Eliminate working capital lock-up by securing verified customer deposits before importing high-ticket engineering gear.
3. **Agile Local Fulfillment:** Ship standard accessories within 24 hours in Dhaka by dispatching runners to wholesale stalls on-demand.

### 1.3 Success Metrics (KPIs)
| Metric | Phase 1 Target (first 6 months) | Purpose & Measurement |
| :--- | :--- | :--- |
| **Website Conversion Rate** | ≥ 1.5% | Tracked separately for Authentic vs. Budget Smart tiers (§3.17). |
| **Return / Replacement Rate — Authentic** | ≤ 2% | Validates official distributor supply chain integrity. |
| **Return / Replacement Rate — Budget Smart**| ≤ 5% | Monitored per vendor to eliminate low-grade wholesale stalls. |
| **Verification Engagement Rate** | ≥ 25% of delivered orders | Measured via QR scan and Seal ID lookups on `/verify`. |
| **Pre-Order Fulfilment Rate** | ≥ 95% | Ratio of successful imports delivered vs. customer deposits taken. |
| **Avg. Delivery Time (Inside Dhaka)** | ≤ 24 hours | Time from order placement to doorstep for Drop-and-Pack items. |
| **COD Return-to-Origin (RTO) Rate** | ≤ 8% | Enforced via phone OTP and advance delivery fees on first orders. |
| **Repeat Customer Rate** | ≥ 20% | Measures customer retention and brand equity. |
| **RMA Turnaround Time (TAT)** | ≤ 72h (Dhaka) / ≤ 5 days (Nationwide) | Time from claim approval to replacement delivery at customer doorstep. |
| **Dead-on-Arrival (DOA) Rate** | < 0.5% | Objective metric of godown QC diligence before parcel handover. |
| **Gross Margin per Drop-and-Pack Order** | 15%–25% net margin | Evaluated post-runner pickup and packaging overhead. |
| **Supplier Defect Score** | Defect rate < 3% per vendor | Wholesale stalls exceeding 3% return rates are suspended. |
| **Unreconciled Settlements** | 0 items older than 7 days | Courier COD remittances and SSLCommerz settlements fully matched (§3.13). |

---

## 2. Target Users & Personas

### 2.1 Persona Matrix

| Persona | Description | Core Pain Points | NCAMart Solution |
| :--- | :--- | :--- | :--- |
| **P1: Brand Purist & Quality Seeker** | Tech enthusiasts, developers, and corporate professionals buying UGREEN, Baseus, Aqara, Anker. | Prevalent fakes sold as originals; voided distributor warranties. | "Authentic Tier" badge, official distributor warranty, unbroken factory seal, serial number lookup. |
| **P2: Pragmatic Budget Shopper** | Students and casual users looking for functional daily cables, adapters, and utility gadgets. | Paying original prices for fakes; devices dead-on-arrival with zero recourse. | "Budget Smart (Tested OEM)" tier with honest labeling, 3-point QC testing, and a 7-day shop replacement warranty. |
| **P3: Field Professional & Technician** | Electricians, HVAC technicians, and network engineers needing UNI-T meters or HIKMICRO cameras. | Specialized tools unavailable locally or sold at extreme markups; no formal VAT receipts. | Dedicated Pre-Order catalog for industrial tech, guaranteed genuine procurement, and NBR Mushak 6.3 tax invoices. |
| **P4: Early Tech Adopter** | Smart home builders seeking Matter hubs, smart door locks, and portable power stations. | High upfront cost; risky personal imports dead-on-arrival without local support. | Safe pre-order gateway with a 10%–20% deposit, customs clearance pre-screening, and pre-dispatch QC testing. |
| **P5: Operations & QC Staff** | The internal fulfillment and testing team at the Nawabpur central godown. | Manual order tracking, mismatched warranty serials, and unorganized vendor returns. | Unified fulfillment dashboard with serial logging, QC checklist, thermal label printing, and runner task management. |
| **P6: Wholesale Merchant Partners** | Wholesale stall owners in Sundarban Square, Stadium Market, and Nawabpur Complex. | Fragmented retail orders, delayed cash settlements, and unverified return claims. | Digital runner pickup slips, daily stock status updates, and transparent vendor defect scorecards. |
| **P7: Customer Support & RMA Officers** | Internal agents handling customer inquiries, milestone updates, and warranty adjudications. | Disputed customer claims, fraudulent returns, and delayed courier status tracking. | Integrated RMA portal with courier reverse-logistics booking and immutable QC inspection photo archives. |
| **P8: Finance & Accounts Officer** | Internal staff responsible for cash, settlements, refunds, and VAT records. | Courier COD remittances that don't match orders; runner cash leakage; manual refund tracking. | In-house double-entry ledger, automated COD/gateway settlement matching, runner float sessions, refund queue (§3.13–§3.14). |

---

## 3. Core Features & System Architecture

### 3.0 Product Categories (Phase 1)
| Category | Examples | Default Fulfilment Model |
| :--- | :--- | :--- |
| **Mobile & Laptop Accessories** | Chargers, GaN adapters, cables, power banks, hubs | Drop-and-Pack |
| **Audio & Wearables** | Earbuds, headphones, smartwatches | Drop-and-Pack |
| **Small Appliances & Utility Tech** | Trimmers, mini fans, extension boards, LED work-lights | Drop-and-Pack |
| **Smart Home & Security** | Global-version smart door locks, Matter hubs, robot vacuums, IP cameras | Pre-Order |
| **Professional Tools** | HIKMICRO thermal cameras, UNI-T clamp meters & multimeters | Pre-Order |
| **Emergency & Power** | Portable power stations, 70mai wireless car jump starters | Pre-Order |

---

### 3.1 Two-Tier Product Architecture
Every catalog SKU is strictly bound to one of two tiers, clearly marked across search, product cards, comparison tables, and checkout:
1. **Authentic Tier:**
   - **Visual Badge:** Verified Blue/Gold Authentic Badge.
   - **Sourcing:** Authorized channel / official brand distributor.
   - **Guarantee:** Official manufacturer warranty + online serial number verification.
2. **Budget Tier ("Budget Smart (Tested OEM)"):**
   - **Visual Badge:** Teal/Slate Budget Alternative Badge labeled strictly as **"Budget Smart (Tested OEM)"**.
   - **Sourcing:** Tested unbranded or OEM utility products from vetted local wholesale stalls.
   - **Guarantee:** In-house 3-point physical testing + 7-day NCAMart replacement warranty.
   - **Strict Policy — Zero Replicas:** Budget Tier must **never** include products that copy another brand's logo, trademark, packaging, or trade dress. Any SKU attempting to mimic an established brand is rejected during catalog onboarding (§3.15).
3. **Side-by-Side Comparison Module:**
   - Programmatically linked between equivalent Authentic and Budget SKUs via `comparison_group_id`.
   - Category-specific comparison templates:
     - *Chargers/Power:* Output wattage, PD/QC protocol support, heat at full load, safety chips (OVP/OCP/OTP), certifications.
     - *Cables:* Max wattage, data speed, connector material, bend-test rating, length.
     - *Audio:* Driver size, codec support, battery life, ANC, Bluetooth version.
     - *All categories:* Build material, price, warranty coverage, and visual value badges ("Full Safety Suite" vs. "Best Everyday Value").

---

### 3.2 Trust & Verification Engine
1. **Cryptographic Base32 Seal ID Entropy:**
   - Format: `NCA-` + `4 characters` + `-` + `4 characters` using the **Crockford Base32 alphabet** (`0123456789ABCDEFGHJKMNPQRSTVWXYZ` — 32 symbols; excludes I, L, O, U to avoid misreading). Example: `NCA-8F2K-9X41`.
   - Validation regex: `^NCA-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$`.
   - $32^8 \approx 1.09 \times 10^{12}$ combinations; each character drawn independently with a CSPRNG (`crypto.randomInt(32)`), unique constraint in DB with retry on collision.
   - Input normalization on `/verify`: uppercase, strip spaces/hyphens, map `O→0` and `I/L→1` before validation.
   - Dual-ID structure: **NCAMart Seal ID** (all items) and **Manufacturer Serial** (Authentic Tier items only, bound in database).
2. **Destructive Tamper-Evident VOID Security Seals:**
   - Physical labels printed on specialized **Destructive VOID material**. Any attempt to peel or transfer the sticker results in immediate label disintegration and reveals a permanent "VOID" substrate pattern.
3. **Direct Serial & Warranty Lookup Portal (`/verify`):**
   - Customers enter a Seal ID or Manufacturer Serial, or scan the QR code printed on the physical seal.
   - Returns: Product name, tier badge, QC inspection timestamp, inspecting technician ID, active warranty countdown, and a **"Start Warranty Claim"** button.
   - **Rate Limiting & Anti-Scraping (CGNAT-safe):** Bangladeshi mobile users share IPs via carrier-grade NAT, so limits are keyed primarily on a first-party anonymous device ID: max **5 lookups/minute per device** and **60 lookups/minute per IP**. Exceeding either triggers a Cloudflare Turnstile challenge; repeated abuse triggers a 15-minute block for that device/IP.
   - **Cloned Seal Anomaly Detection:** Raise internal alert `CLONED_SEAL_SUSPECTED` when, within 24 hours, a Seal ID is looked up from **≥ 5 distinct device IDs across ≥ 2 distinct districts** (IP geolocation), or when any lookup hits a seal in `void_print_error` status. The portal still displays standard info; the alert is internal only and reviewed by the Super Admin. IP count alone is never used as a trigger.
4. **Tier-Specific QC Protocols:**
   - **Budget Tier / Open-Box — 3-Point QC:** Full unboxing, power/voltage test, port/function check, physical integrity. Technician records checklist in admin, reseals packaging, and applies NCAMart Seal.
   - **Authentic Tier, Factory-Sealed — Non-Invasive QC:** Factory seal is **strictly preserved**. Staff inspect brand holograms, match box serials to distributor invoices, and verify packaging integrity. Seal applied over outer protective shrink-wrap.
   - **Pre-Order Imports — Comprehensive Pre-Dispatch QC:** Unboxed and functionally tested before domestic dispatch to prevent dead-on-arrival imports.
   - **Supervisor 5% Sampling Quota:** System randomly flags 5% of all QC-cleared parcels for mandatory secondary audit by the Godown Manager before courier handover. Sampled parcels must be audited within 2 hours; if not, the task escalates to the Super Admin so the 24-hour Dhaka SLA is protected.
   - **Printer Jam / Sticker Void Protocol:** If a printer jams or ruins a seal, technician logs a void action with reason (`PRINTER_JAM`, `RIBBON_TEAR`, `STICKER_DAMAGED`). System marks old ID as `void_print_error` and generates a fresh Seal ID. Voids are approved by the Godown Manager or Sourcing Manager (§3.9).

---

### 3.3 High-End Pre-Order & Import Engine
1. **Isolated Pre-Order Checkout Flow:**
   - **Strict Rule:** Pre-Order items and standard Drop-and-Pack items **cannot be checked out together in the same cart**.
   - If a customer attempts to combine items, a modal appears: *"Pre-order items require a separate advance deposit and have different delivery timelines. Please checkout regular items first or clear your cart."*
   - Server-side validation rejects mixed carts with `HTTP 422 Unprocessable Entity` (`ERR_MIXED_CART_DISALLOWED`).
2. **Progressive Deposit Gateway (no price cliff):**
   - Deposit is calculated **per unit** on the final unit price (after any coupon discount), then multiplied by quantity and summed across lines:
     $$\text{Deposit}_{unit} = 20\% \times \min(P, ৳50{,}000) + 10\% \times \max(P - ৳50{,}000,\ 0)$$
   - Rounded **up** to the nearest ৳10 and never greater than the unit price.
   - The effective rate always stays between 10% and 20% and never drops when price rises:

     | Unit Price | Deposit | Effective Rate |
     | :--- | :--- | :--- |
     | ৳30,000 | ৳6,000 | 20% |
     | ৳50,000 | ৳10,000 | 20% |
     | ৳80,000 | ৳13,000 | 16.3% |
     | ৳150,000 | ৳20,000 | 13.3% |
     | ৳300,000 | ৳35,000 | 11.7% |
   - Paid online via **SSLCommerz** (bKash, Nagad, Cards). Store credit may also be applied (§3.14).
   - **Balance Payment Rule:** Balance = order total − deposit − store credit applied. Balance can always be paid online. Balance via COD is allowed only if the balance ≤ `PREORDER_COD_BALANCE_MAX` (default **৳30,000**, configurable, to be confirmed against courier COD limits) **and** the customer is not COD-blocked. Larger balances must be paid online before dispatch, or at the showroom counter on pickup.
3. **Regulatory Pre-Screening (BTRC & Customs Compliance):**
   - Catalog Manager must verify HS Codes and confirm BTRC Type Approval / NOC eligibility for all wireless, RF, and smart-home gadgets prior to catalog publication. The system blocks publishing while `btrc_cleared = false` for these categories (§3.15).
4. **Milestone Tracking:**
   - Status progression: *Order Placed (Deposit Verified)* → *Sourced & In Transit* → *Arrived at Nawabpur Godown* → *QC Verified* → *Out for Delivery (Balance Due via COD/Online)*. Exact system statuses are defined in §3.12.
5. **Pre-Order Policies & Default Handling:**
   | Scenario | Policy & System Action |
   | :--- | :--- |
   | **Import fails / supplier stockout** | 100% deposit refund within 7 working days, or customer option to switch SKU. |
   | **Delay beyond promised ETA + 7 days** | Customer may cancel with 100% full refund within 24 hours, or keep the order and receive a ৳1,000 store credit on arrival (§3.14). |
   | **Customer cancels before cargo dispatch** | 100% deposit refund. |
   | **Customer cancels after cargo flight booked**| Deposit non-refundable. UI disables cancellation once status reaches `SOURCED_IN_TRANSIT`. |
   | **Exchange rate volatility (> 8%)** | Landed price includes a 5%–8% currency buffer. If currency devalues > 8%, a Re-Pricing Approval Ticket is sent (48-hour response window). Customer may accept the adjusted price (only the balance changes; deposit is unchanged) or receive 100% refund. |
   | **Customer default on arrival balance** | Automated reminders on Day 1, 4, 7 after QC. On **Day 8**, deposit is forfeited, order cancelled, and item re-listed as an **In-Stock Flash Deal** at landed price (moves to physical inventory, §3.11). |
   | **Batch threshold failure** | If N pre-orders not reached within 30 days, system triggers 100% refund or offers individual expedited import fee. |

---

### 3.4 Local "Drop-and-Pack" Order Management
1. **Proximity-Based Runner Sourcing:**
   - High-velocity orders dispatch a digital pickup ticket to the godown runner, who collects the item from Nawabpur, Sundarban, or Stadium partner stalls within 2 hours. If the SKU is available in physical stock (§3.11), physical stock is used first and no runner task is created.
2. **Wholesale Spot Price Tolerance Buffer:**
   - If a wholesaler raises counter price, runner inputs updated price into mobile app.
   - Automated price tolerance buffer per SKU (`spot_buffer_pct`, range 5%–7%, default 5%) allows pickup to proceed if gross margin remains ≥ 15%.
   - **Margin definition:** (list selling price excl. VAT − purchase cost) ÷ list selling price excl. VAT. Delivery fees and coupon discounts are excluded (coupons are treated as marketing cost).
   - If price increase exceeds buffer or margin < 15%, runner app freezes task and routes a real-time alert to Sourcing Manager (Approve override, switch to backup stall, or decline & refund). If the alert is not acknowledged in 5 minutes it is re-sent via WhatsApp/SMS.
3. **Offline Runner Sourcing PWA Mode:**
   - Mobile web app utilizes Service Workers and IndexedDB. In basement stalls with zero 4G reception, runners can record vendor receipts and prices offline; data syncs when connectivity returns (on app foreground, periodically while open, and via a manual "Sync now" button — iOS does not support background sync).
   - Every offline record carries a client-generated unique ID so re-sending never creates duplicates.
   - **Conflict rule:** If a task was cancelled or reassigned while the runner was offline, the synced purchase is accepted as a `CONFLICT` record; the item is received into physical godown stock (§3.11) and the Sourcing Manager is notified.
4. **Virtual Stock Availability & Fallback:**
   - SKUs maintain daily confirmed status (`Available` / `Limited` / `Out`) across primary and backup vendors. `Limited` SKUs may carry an optional daily order cap.
   - If all partners are out of stock, customer is notified within 4 hours with options: immediate refund, alternate tier recommendation, or backorder.
5. **Runner Cash:** Runners purchase from a daily cash float or on supplier credit; all purchases are reconciled at end of shift (§3.13.4).
6. **Customer Cancellation (Drop-and-Pack):**
   - Self-service cancellation is allowed until the runner records the purchase; full refund of all amounts paid.
   - After purchase and before courier handover: cancellation via Support only; full refund; the item is received into physical stock.
   - After courier handover: refusal at the door follows the RTO flow (Flow 7).

---

### 3.5 Customer Account & Authentication
- **Phone Number + OTP Login:** Passwordless authentication using Bangladeshi MSISDN validation (`^(?:\+8801|01)[3-9]\d{8}$`), normalized to `+8801XXXXXXXXX`.
- **OTP Security Rules:** 6-digit OTP, expires in 3 minutes, max 3 attempts per OTP, max 3 send requests per 10 minutes per phone (plus max 20 per hour per IP).
- **Sessions:** Server-side, revocable sessions in HttpOnly Secure cookies. Customers can view and log out other devices.
- **Customer Portal:** Order history, pre-order milestone visualizer, **"My Warranties"** (active Seal IDs with countdown timers), saved addresses, store credit balance.
- **Guest Checkout:** Permitted, with mandatory phone OTP verification prior to order placement. Guest orders are automatically attached to the account that later logs in with the same verified phone.
- **Phone Number Change:** A logged-in customer can move their account to a new number after verifying OTP on the new number.
- **Phone Number Recycling Protection:** Bangladeshi operators reassign inactive numbers. If an account has had no activity for **12 months**, the next OTP login opens a fresh session that cannot see past orders, addresses, or warranties until the user confirms ownership (email OTP if an email is on file, or Support verification of a past order). If not confirmed, a new account is created and the old one is frozen for Support review.
- **Warranty Ownership:** Warranties are bound to the **Seal ID**, not the phone number, so they remain valid if the product changes hands or the number changes.

---

### 3.6 Payments & Checkout
1. **Primary Payment Gateway — SSLCommerz:**
   - Full integration with SSLCommerz handling direct bKash, Nagad, Rocket, Visa, Mastercard, and AmEx transactions.
   - PCI-DSS compliant hosted payment flow (no card credentials stored locally).
   - **Callback Verification:** Server validates all IPN payloads (`verify_sign`/hash with Store Password) **and** confirms every transaction through the server-to-server Order Validation API before changing any order state. Transactions flagged by SSLCommerz as high risk are held for manual review.
   - **Automated 5-Minute Reconciliation Cron Job:** System queries SSLCommerz Transaction Validation API for any transaction in `PENDING` state older than 10 minutes (up to 24 hours old), flipping dropped transactions to `PAID` automatically.
2. **Cash on Delivery (COD) & Anti-Fraud Policy:**
   - **First-Time Buyers** (and any customer with `rto_count_12m == 1`): Must pay the base delivery fee (**৳80 Inside Dhaka / ৳150 Nationwide**) in advance via bKash/Nagad on SSLCommerz to confirm order. Remaining product balance (plus any weight surcharge) collected on delivery.
   - **Verified Repeat Buyers:** Eligible for **100% Cash on Delivery** with zero advance payment required (provided `rto_count_12m == 0` and delivered orders ≥ 1).
   - **High-Risk Block:** Phone numbers with `rto_count_12m >= 2` (RTOs in the last rolling 12 months) lose COD access. Support may lift a block with a recorded reason (audit-logged).
   - Store credit can never be used to pay the advance delivery fee.
3. **10-Minute Inventory Reservation:**
   - Starting checkout reserves **physical stock** units (§3.11) for 10 minutes. If payment or COD confirmation is not completed in 10 minutes, the reservation is released. Virtual (stall-sourced) items are not reserved.
   - If a payment is confirmed after the reservation expired (e.g., via reconciliation), the system tries to re-reserve; if no physical stock remains it falls back to stall sourcing, and if that is impossible the customer is refunded automatically.
4. **Pricing, VAT & Invoicing:**
   - All displayed prices are **VAT-inclusive** final prices. Each product carries a `vat_rate_pct`; invoices show the VAT breakdown.
   - Every order gets a system invoice. Checkbox at checkout: *"Request Mushak 6.3 Tax Invoice"* captures corporate name and BIN and generates an NBR-compliant Mushak 6.3 PDF with a **gapless sequential serial per fiscal year (July–June)**.
   - VAT rates and invoicing obligations are to be confirmed by a VAT consultant before launch (§8).
5. **Coupons & Store Credit:** One coupon per order and store credit can be applied at checkout (§3.14).
6. **Currency:** All pricing is strictly in **BDT (৳) only**. Amounts are stored internally as integer paisa to avoid rounding errors.

---

### 3.7 Delivery & Logistics
- **Courier Integration:** Steadfast, Pathao, and RedX with automated API webhook synchronization for parcel tracking. Courier-specific statuses are normalized to one internal set (§3.12). A polling fallback refreshes any shipment with no update for 24 hours.
- **Message Queue & Exponential Backoff:** Courier booking calls decoupled via message queue (BullMQ). Retries on failure at 1m, 5m, 15m, 30m before escalating to manual dispatch console.
- **Address Structure:** Division → District → Thana/Upazila → Area + address line, mapped to each courier's location IDs through a maintained mapping table.
- **Delivery Fees:** One fee per shipment. Base zone fee (৳80 Inside Dhaka / ৳150 Nationwide) covers parcels up to 1 kg; heavier parcels add a configurable per-kg surcharge mirroring courier contract rates. If an order is split because of a partial stockout (EC-05), the customer is charged only once.
- **Delivery Zones & SLAs:**
  - *Inside Dhaka:* 24–48 hours (Drop-and-Pack items).
  - *Outside Dhaka:* 2–5 business days.
- **Partial Delivery:** If a customer accepts only some items at the door, the courier's partial-delivery status is recorded; returned items follow the RTO flow and the COD amount is reconciled accordingly (§3.13).
- **Showroom Counter Pickup (Nawabpur Complex):**
  - Customer receives a 6-digit **Pickup PIN** (stored hashed; valid 7 days; locked after 5 wrong attempts until Support resets it).
  - **Payment:** Pay-at-counter is allowed only for items already in showroom physical stock or for verified repeat buyers; otherwise full online prepayment is required. No delivery fee applies.
  - Showroom staff enters PIN into **Showroom POS Mode** to verify order.
  - Customer inspects item on counter test-bench and signs handover slip. Real-time central inventory sync prevents online stockout collisions.
  - **Unclaimed pickups:** Reminders on Day 3 and Day 6. Unpaid orders are cancelled on Day 8 and the item returns to sellable stock. Prepaid orders are held up to 14 days, after which Support contacts the customer and arranges courier delivery or a refund.
- **Showroom Walk-In Sales:**
  - Counter staff can sell items from showroom physical stock directly (POS sale). Each item must already carry an active NCAMart Seal.
  - Payment methods: cash, bKash/Nagad merchant QR, or card via a standalone bank card terminal (reference number recorded; no hardware integration).
  - Customer phone number is required to register the warranty (OTP optional at counter). A receipt is printed on the thermal printer.
  - Every POS shift opens and closes a **cash drawer session** with counted cash; variances go to Finance (§3.13).

---

### 3.8 Returns, Refunds & Warranty (RMA)
1. **Budget Smart (Tested OEM) — 7-Day Replacement:** Covers functional failure within 7 calendar days of delivery. Replaced with identical SKU or refunded if unavailable.
2. **Authentic Tier — Official Manufacturer Warranty:** NCAMart provides an assisted liaison service: collects unit, logs claim with authorized distributor service centers (Star Tech, Ryans, Excel Technologies), and returns repaired unit to customer.
3. **DOA (Dead on Arrival):** Must be reported within 48 hours accompanied by unboxing video. Fast-tracked replacement dispatched within 24 hours.
4. **Reverse Logistics Courier Doorstep Pickup:** Support Agent triggers automated reverse-pickup consignment via courier API (or manual booking where the courier offers no API). Defective unit collected directly from customer home.
5. **Exclusions:** Physical impact, liquid ingress, severed cables, or tampered/broken NCAMart VOID seals void all warranty coverage.
6. **RMA Turnaround Time (TAT) Target:** Maximum 72 hours for Dhaka; maximum 5 business days nationwide.
7. **Warranty Start Date:** The courier "delivered" event, or the counter handover time for pickup/walk-in sales. If no delivered event arrives, the fallback is dispatch date + 3 days (Dhaka) / + 5 days (outside Dhaka). Pre-order items follow the same rule.
8. **Claim Media Upload:**
   - Photos: up to 5 files, JPG/PNG/WebP/HEIC, max 10 MB each.
   - Video: 1 file, MP4/MOV/WebM, max 300 MB and 3 minutes, uploaded directly to object storage with resumable upload.
   - If the upload fails, the customer may send the video via WhatsApp quoting the claim number; Support attaches it to the claim.
9. **Refund Execution:** All RMA refunds follow the refund rules in §3.14.

---

### 3.9 Role-Based Access Control (RBAC) Matrix

**Roles:** 2 customer-side roles (Guest, Customer) and 10 staff roles. A single person may hold more than one staff role in the early phase; permissions are additive.

| Role | Responsibility |
| :--- | :--- |
| **Field Runner** | Sourcing pickups, supplier returns, warranty liaison trips. |
| **QC Technician** | QC checklists, seal printing, inspection of returns. |
| **Godown Manager** | Supervisor 5% sampling, godown stock control, seal void approval. |
| **Dispatch Staff** | Packaging station, shipping labels, courier booking & manual dispatch fallback. |
| **Showroom POS Staff** | Counter pickup and walk-in sales, cash drawer. |
| **Sourcing Manager** | Runner assignment, spot-price approvals, supplier management. |
| **Catalog Manager** | Product drafts, comparison groups, BTRC/HS data, coupon drafts. |
| **Support Agent** | Customer support, RMA adjudication, small refunds/credits. |
| **Finance Officer** | Ledger, settlements, runner floats, refunds execution, VAT records. |
| **Super Admin** | Full access, approvals, staff management. |

Abbreviations: **G** Guest · **C** Customer · **FR** Field Runner · **QC** QC Technician · **GM** Godown Manager · **DS** Dispatch Staff · **POS** Showroom POS · **SM** Sourcing Manager · **CM** Catalog Manager · **SA** Support Agent · **FO** Finance Officer · **AD** Super Admin

| Resource / Action | G | C | FR | QC | GM | DS | POS | SM | CM | SA | FO | AD |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Browse catalog & `/verify` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Place order / pay deposit | OTP→C | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Runner pickup tasks | ❌ | ❌ | Own | ❌ | Read | ❌ | ❌ | Assign | ❌ | ❌ | ❌ | ✅ |
| Input wholesale purchase price | ❌ | ❌ | Input | ❌ | ❌ | ❌ | ❌ | Override | ❌ | ❌ | ❌ | ✅ |
| Execute QC checklist & print seal | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Supervisor 5% sampling audit | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Approve void of damaged Seal ID | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Packing, labels, courier booking | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Receive RTO / RMA parcels | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Stock adjustment / write-off | ❌ | ❌ | ❌ | ❌ | Request | ❌ | ❌ | ❌ | ❌ | ❌ | Approve | ✅ |
| Showroom POS (pickup & walk-in) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Cash drawer close | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Count | ❌ | ❌ | ❌ | Reconcile | ✅ |
| View customer PII | ❌ | Own | Masked | Masked | Masked | Shipping only | Counter only | Masked | ❌ | ✅ Read | Billing only | ✅ |
| Approve spot price over-buffer | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Adjudicate RMA claim | ❌ | Own claims | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Approve refund | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ≤ ৳1,000 | ≤ ৳20,000 | ✅ |
| Execute manual refund payout | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Issue store credit / voucher | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ≤ ৳1,000 | ≤ ৳20,000 | ✅ |
| Edit catalog / product tiers | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Draft | ❌ | ❌ | Approve & publish |
| Coupons | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Draft | ❌ | ❌ | Activate |
| Runner cash float | ❌ | ❌ | Own | ❌ | ❌ | ❌ | ❌ | Read | ❌ | ❌ | Issue & reconcile | ✅ |
| COD & gateway settlement reconciliation | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Ledger, financial & profit reports | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Read & export | ✅ |
| Staff, roles & audit log | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

*Security Rule on PII Masking: Field runners only see Order #, Item SKU, Quantity, Wholesale Stall #, and Max Purchase Price. Full shipping addresses are restricted to Dispatch Staff at the central godown packaging station. "Billing only" = name, BIN and invoice details.*

*All staff accounts require TOTP two-factor authentication. Every staff action that changes data — including Super Admin actions — is written to the immutable audit log.*

---

### 3.10 Multi-Channel Notification Matrix

**Notification classes:**
- **Class A — Critical transactional:** sent 24/7 immediately.
- **Class B — Operational transactional:** sent between **08:00 and 22:00 (Asia/Dhaka)**; anything triggered outside this window is queued until 08:00. This is an NCAMart courtesy policy.
- **Class C — Promotional:** sent only between 08:00 and 22:00 (BTRC requirement), only to customers who have opted in, and always with an opt-out option.

| Lifecycle Trigger | Class | SMS | WhatsApp | Email | Delivery SLA / Window |
| :--- | :-: | :---: | :---: | :---: | :--- |
| **1. OTP Verification Code** | A | ✅ | — | — | Real-time (< 15 sec) |
| **2. Order Placed (Pre/Drop)** | A | ✅ | ✅ | ✅ | Instant (< 1 min) |
| **3. Payment / Advance Delivery Fee Confirmed** | A | ✅ | ✅ | ✅ | Instant (< 1 min) |
| **4. Refund Processed** | A | ✅ | ✅ | ✅ | Instant on completion |
| **5. Pre-Order Sourced / In Transit** | B | ✅ | ✅ | ✅ | Within 2 hours of update |
| **6. Pre-Order QC Passed / Balance Due** | B | ✅ | ✅ | ✅ | Instant upon QC pass (within window) |
| **7. Out for Delivery Alert** | B | ✅ | ✅ | — | Morning of delivery |
| **8. Pre-Order Balance Reminder (D1, 4, 7)** | B | ✅ | ✅ | ✅ | 10:00 AM |
| **9. Pickup Ready / Pickup Reminders** | B | ✅ | ✅ | — | Instant (within window) |
| **10. RMA Status Change** | B | ✅ | ✅ | ✅ | Within 1 hour of review |
| **11. Promotions, Back-in-Stock, Abandoned Cart** | C | ✅ | ✅ | ✅ | Opt-in only, 08:00–22:00 |
| **12. Cloned Seal Alert (Security)** | A (internal) | Admin | Admin | Admin | Urgent real-time (< 1 min) |

*Reliability: A circuit breaker falls back from SMS to WhatsApp (or a secondary SMS route) on delivery failure. Every message is recorded in a notification log. WhatsApp templates must be pre-approved and the SMS sender ID registered before launch.*

---

### 3.11 Inventory Model (Physical vs. Virtual)
1. **Two stock sources:**
   - **Virtual stock:** Items available at partner stalls, represented by `SupplierStock` status (`available` / `limited` / `out`). Not counted or reserved; sourced by runner after the order.
   - **Physical stock:** Items NCAMart actually holds, tracked by unit count per **location**: `godown`, `showroom`, `qc_hold`, `rma_hold`, `damaged`, `in_transit`. Only `godown` and `showroom` are sellable.
2. **How physical stock arises:** RTO returns with intact seals, forfeited pre-order items (Flash Deals), customer cancellations after runner purchase, runner `CONFLICT` purchases, intentional bulk buys, and showroom display stock.
3. **Allocation at order time:** Physical stock first (godown, then showroom for courier orders; showroom first for pickup orders), then virtual stock, else the SKU is not purchasable.
4. **Storefront availability labels:** "In stock — ships today" (physical), "Available — ships within 24h" (virtual), "Out of stock".
5. **Reservations:** 10-minute reservations apply to physical stock only (§3.6.3); availability = on hand − active reservations.
6. **Stock movement ledger:** Every receipt, transfer, sale, return, write-off, and adjustment is recorded as an append-only movement with reason, reference, unit cost, and staff ID. On-hand balances are derived from movements.
7. **Cycle counts:** Monthly physical count of godown and showroom; variances become adjustment requests approved by Finance.

---

### 3.12 Order & Payment State Machines
1. **Regular (Drop-and-Pack) order statuses:**
   `PENDING_PAYMENT` → `CONFIRMED` → `SOURCING` (virtual items only) → `AT_GODOWN_QC` → `PACKED` → `HANDED_TO_COURIER` → `DELIVERED` | `PARTIALLY_DELIVERED` | `RTO_IN_TRANSIT` → `RTO_RECEIVED`.
   Pickup branch: `PACKED` → `READY_FOR_PICKUP` → `DELIVERED_COUNTER` | `PICKUP_EXPIRED`.
   `CANCELLED` is reachable from `PENDING_PAYMENT`, `CONFIRMED`, `SOURCING`, and `AT_GODOWN_QC` (rules in §3.4.6).
   `PENDING_PAYMENT` orders auto-cancel after 24 hours if no payment is confirmed.
2. **Pre-order statuses:**
   `DEPOSIT_PENDING` → `DEPOSIT_PAID` → `SOURCED_IN_TRANSIT` → `ARRIVED_GODOWN` → `QC_VERIFIED_BALANCE_DUE` → `BALANCE_PAID` or `BALANCE_COD_SCHEDULED` → `PACKED` → (same delivery/pickup path as regular orders).
   Branches: `REPRICING_PENDING`, `CANCELLED_REFUNDED`, `DEPOSIT_FORFEITED_CANCELLED`.
3. **Payment status (per order):** `UNPAID`, `PENDING`, `PARTIALLY_PAID`, `PAID`, `REFUND_PENDING`, `PARTIALLY_REFUNDED`, `REFUNDED`, `FAILED`.
4. **Rules:** Only defined transitions are allowed; every transition records actor, time, and reason; illegal transitions are rejected by the server. Courier statuses are mapped into these statuses.

---

### 3.13 Finance Ledger & Reconciliation (In-House)
1. **Double-entry ledger:** Every financial event posts a balanced journal entry (debits = credits) in the same database transaction as the business change. Entries are never edited or deleted; corrections are made with reversing entries.
2. **Revenue recognition:** Money received before delivery (online payments, advance delivery fees, pre-order deposits) is held as a customer liability. Revenue, VAT payable, and cost of goods are recognized at delivery (courier delivered, counter handover, or walk-in sale). Pre-order deposits are tracked in a separate liability account so they can be reported (and escrowed if required, §8).
3. **Courier COD reconciliation:**
   - Each shipment records the expected COD amount at booking.
   - Courier payouts are imported (API where available, otherwise CSV upload by Finance) and matched per consignment: collected amount, delivery charge, COD charge, return charge.
   - Mismatches are classified (`SHORT_PAID`, `OVER_PAID`, `MISSING` — delivered but not in any payout after 7 days, `UNKNOWN_CONSIGNMENT`) and placed in an exception queue.
   - Daily aging alerts for courier receivables older than 7 days.
4. **Runner cash float:**
   - Finance issues a float to each runner at shift start (float session).
   - Each purchase records amount, stall, and receipt photo. Purchases without a receipt photo are flagged; above a configurable amount (default ৳2,000) they need Sourcing Manager approval.
   - Purchases can also be on **supplier credit**, which creates a supplier payable settled later by Finance.
   - At shift end the runner returns unused cash; Finance counts it. Variance = issued − purchases − returned. Any non-zero variance needs Sourcing Manager and Finance sign-off and is reported per runner.
   - Supplier refunds for rejected batches are recorded against the float or as a supplier credit note.
5. **Gateway settlement reconciliation:** SSLCommerz settlement reports are imported and matched per transaction; gateway fees are booked as expenses.
6. **Showroom cash drawer:** Opening float, expected cash from POS sales, counted cash, variance to Finance.
7. **Reports:** Trial balance, profit & loss, courier receivable aging, customer deposit balance, runner float status, supplier payables, VAT sales register; CSV/Excel export.

---

### 3.14 Refunds, Store Credit & Coupons
1. **Refund triggers:** Cancellation, stockout, pre-order import failure, delay cancellation, re-pricing rejection, RMA refund, overpayment.
2. **Approval limits:** Support ≤ ৳1,000; Finance ≤ ৳20,000; Super Admin above (§3.9).
3. **Refund method order:**
   - Online payments: back to the original method through the SSLCommerz refund API where supported.
   - Otherwise (including COD orders): manual bKash/Nagad/bank transfer by Finance, recording the reference number and proof.
   - Store credit only if the customer explicitly chooses it.
4. **Refund SLA:** Refund initiated within 24 hours of approval; money reaches the customer within **7 working days** at most. Faster targets stated elsewhere in this PRD remain targets inside this maximum.
5. **Refund amount:** The amount actually paid for the line (after allocated coupon discount). Advance delivery fees are refunded unless the parcel was handed to the courier.
6. **Store credit:**
   - Per-customer credit balance, held as a liability in the ledger.
   - Sources: goodwill vouchers (e.g., the ৳1,000 pre-order delay voucher), RMA resolutions, or customer-chosen refunds.
   - Goodwill credit expires after 12 months (configurable) and cannot be withdrawn as cash. Credit issued in place of a refund never expires and can be withdrawn on request.
   - Can pay product amounts and pre-order deposits/balances; can never pay the advance delivery fee.
7. **Coupons (Phase 1):**
   - Fixed or percentage discount, minimum order value, maximum discount, scope (tier/category/SKU), validity window, total usage limit, per-phone limit (default 1).
   - One coupon per order; not applicable to delivery or advance fees.
   - Discount is allocated pro-rata to order lines (used for VAT, refunds, and pre-order deposit calculation).
   - Created as drafts by the Catalog Manager, activated by the Super Admin.

---

### 3.15 Catalog Governance
1. **Product lifecycle:** `draft` → `pending_review` → `approved` / `rejected` → `published` → `archived`. Catalog Manager creates and edits drafts; Super Admin approves and publishes (four-eyes rule).
2. **Review checklist (mandatory before approval):**
   - Zero-replica attestation and product photos of real packaging (Budget Tier).
   - Distributor invoice or authorization evidence (Authentic Tier).
   - HS code and BTRC status for wireless/RF/smart-home items; the system blocks publishing while `btrc_cleared = false` for these categories.
   - Tier, fulfilment model, VAT rate, weight, and comparison group assigned.
3. **Comparison groups & spec templates:** Maintained by the Catalog Manager; each category has a structured spec template so comparisons are consistent.

---

### 3.16 Search, Reviews & Engagement
1. **Search (Phase 1):** Bangla, English, and Banglish queries (e.g., "চার্জার", "charger 65w") with typo tolerance, synonyms, and filters by tier, category, brand, price, and availability.
2. **Verified reviews (Phase 1.5):** Only customers with a delivered order item can review it; review invitation 3 days after delivery (Class B); moderation by Support; no incentivized reviews; tier badge shown next to each review.
3. **Wishlist & back-in-stock alerts (Phase 1.5).**
4. **Abandoned cart reminders (Phase 1.5):** Class C — opt-in only, 08:00–22:00.

---

### 3.17 Analytics & Marketing Feeds
1. **Event tracking** for every KPI in §1.3: product view (with tier), add to cart, checkout started, order placed, payment success/failure, `/verify` lookup and QR scan, RMA submitted, RTO, pre-order milestones. Key events are captured server-side so ad blockers don't distort KPIs.
2. **Tools:** Product analytics (PostHog), GA4, Meta Pixel + Conversions API.
3. **Feeds:** Google Merchant Center and Meta Catalog feeds regenerated hourly from published products.
4. **Consent:** Non-essential tracking follows a cookie consent banner.

---

### 3.18 Data Protection & Device Policy
1. **Retention:**
   - Orders, invoices, and ledger: at least the period required by VAT and income tax law (assume 6 years until confirmed).
   - RMA media: 180 days after claim closure.
   - QC photos: warranty period + 1 year.
   - Seal verification logs: 12 months.
2. **Deletion requests:** The customer profile is anonymized while financial records required by law are kept.
3. **Access:** Every view of full customer PII by staff is logged.
4. **Runner devices:** Staff sessions on runner phones expire after 12 hours and can be revoked remotely. Offline data synced from a revoked device is quarantined for Sourcing Manager review rather than discarded.

---

## 4. End-to-End User & Operational Flows

### Flow 1: Transparent Browsing, Comparison & Isolated Cart
```
[User lands on NCAMart] 
       │
       ▼
[Filters by "Authentic" or "Budget Smart (Tested OEM)"] 
       │
       ▼
[Views Product Detail Page] ──► [Clicks "Compare with Alternative"]
       │                             └─► Opens Spec & Safety Diff
       ▼
[Selects Tier & Adds to Cart]
       │
       ├──► (If cart already has Pre-Order item) ──► [Modal: "Checkout pre-order separately"]
       │
       ▼
[Proceeds to Checkout with Clear Tier Badging]
```

### Flow 2: Pre-Ordering Niche Tech & Milestone Tracking
```
[User navigates to "Pre-Order Tech" / Pro Tools]
       │
       ▼
[Selects Item (e.g., HIKMICRO Thermal Camera / 70mai Jump Starter)]
       │
       ├──► (If cart has regular items) ──► [Modal: "Complete regular order first or clear cart"]
       │
       ▼
[System calculates progressive deposit (20% of first ৳50k + 10% above) + shows ETA, BTRC status & cancellation terms]
       │
       ▼
[User pays deposit via SSLCommerz (bKash / Nagad / Card)]
       │
       ▼
[Order Confirmed & International Sourcing Triggered]
       │
       ▼
[SMS/WhatsApp Milestone Updates] (Procured ──► Customs Cleared ──► Nawabpur QC Passed)
       │
       ▼
[Balance Settlement (Online; COD only if balance ≤ ৳30,000) & Final Delivery]
```

### Flow 3: COD Checkout with First-Time Buyer Delivery Fee
```
[Customer selects Cash on Delivery (COD) at Checkout]
       │
       ▼
[System checks Customer Profile & Order History]
       │
       ├──► [Verified Repeat Buyer (rto_count_12m == 0, delivered orders >= 1)] ──► [Order Confirmed Instantly, 100% COD]
       │
       ├──► [COD Blocked (rto_count_12m >= 2)] ──► [COD hidden; online payment only]
       │
       └──► [First-Time Buyer / rto_count_12m == 1]
                 │
                 ▼
            [Prompts Advance Delivery Fee Payment (৳80 Dhaka / ৳150 Nationwide)]
                 │
                 ▼
            [Customer pays fee via SSLCommerz (bKash/Nagad)]
                 │
                 ▼
            [Order Confirmed; Balance product price marked for Courier COD]
```

### Flow 4: Post-Purchase Serial Verification & Cloned Seal Check
```
[Customer receives parcel with Destructive VOID "Tested & Verified" Seal]
       │
       ▼
[Visits ncamart.com/verify or scans QR on seal]
       │
       ▼
[Enters Seal ID or Manufacturer Serial (input normalized)]
       │
       ├──► [≥ 5 distinct devices across ≥ 2 districts in 24h, or VOID seal] ──► [Trigger Internal Alert: CLONED_SEAL_SUSPECTED]
       │
       ▼
[System displays:]
  ├── Verification Status: Verified Authentic / Verified Budget Smart
  ├── QC Pass Date & Inspecting Technician ID
  └── Active Warranty Period & "Start Warranty Claim" Button
```

### Flow 5: Drop-and-Pack Sourcing & Spot Price Tolerance Workflow
```
[New Drop-and-Pack Order Confirmed (no physical stock available)]
       │
       ▼
[Runner dispatches to Wholesale Stall with PWA Offline Support & cash float]
       │
       ▼
[Wholesaler Counter Price Quoted]
       │
       ├──► [Within SKU buffer (5%–7%) & Margin >= 15%] ──► [Runner purchases, enters cost + receipt photo, returns to Godown]
       │
       └──► [Exceeds Buffer / Margin < 15%]
                 │
                 ▼
            [Real-time Alert to Sourcing Manager (WhatsApp/SMS re-alert after 5 min)]
                 ├── Choice A: Approve override (accept lower margin)
                 ├── Choice B: Re-route runner to Backup Stall #2
                 └── Choice C: Decline & trigger instant customer refund / SKU substitute
```

### Flow 6: Showroom Counter Pickup & Inspection (Nawabpur Complex)
```
[Customer selects "Showroom Counter Pickup" at Checkout]
       │
       ▼
[Godown stages item in Counter Locker + generates 6-digit Pickup PIN via SMS (valid 7 days)]
       │
       ▼
[Customer arrives at Nawabpur showroom & provides PIN]
       │
       ▼
[Showroom Staff enters PIN into Admin POS Mode (5 wrong attempts → locked)]
       │
       ▼
[Customer pays at counter if not prepaid, tests device on counter test-bench & signs handover]
       │
       ▼
[Order marked DELIVERED_COUNTER; Warranty starts; Real-time inventory updated]
```

### Flow 7: Failed Delivery & Return-to-Origin (RTO) Lifecycle
```
[Courier attempts delivery 3 times / Customer refuses parcel]
       │
       ▼
[Courier API webhook: DELIVERY_FAILED_RTO_INITIATED → status RTO_IN_TRANSIT]
       │
       ▼
[Customer record flagged: rto_count_12m += 1] ──(rto_count_12m >= 2)──► [Block future COD access]
       │
       ▼
[Parcel returns to Nawabpur Godown (3–5 business days) → RTO_RECEIVED]
       │
       ▼
[QC Technician inspects parcel exterior]
       ├── [Seal Intact] ──► Restock into physical inventory or return to vendor
       └── [Seal Damaged/Crushed] ──► Lodge transit damage claim against courier
       │
       ▼
[Ledger: advance delivery fee recognized; courier return charge booked on settlement]
```

### Flow 8: Pre-Order Customer Default & Inventory Forfeiture
```
[Pre-Order Item passes QC at Nawabpur Godown]
       │
       ▼
[Day 1: Automated SMS/WhatsApp: Balance due notification]
       │
       ▼ (No payment)
[Day 4: Warning notice: 72 hours remaining]
       │
       ▼ (No payment)
[Day 7: Support agent manual verification phone call]
       │
       ▼ (No response / Refusal)
[Day 8: System triggers DEPOSIT_FORFEITED_CANCELLED]
       │
       ▼
[Deposit forfeited per Terms (ledger: deposit liability → forfeited deposit income); Item moved to physical stock and listed as "In-Stock Flash Deal" at landed price]
```

### Flow 9: Reverse Logistics (Courier Doorstep RMA Pickup)
```
[Customer submits RMA claim on /verify or My Account with unboxing video]
       │
       ▼
[Support Agent reviews & approves within 2 hours]
       │
       ▼
[System triggers GENERATE_REVERSE_PICKUP via Steadfast/Pathao API]
       │
       ▼
[Courier collects parcel from customer home with return consignment note]
       │
       ▼
[Parcel delivered to Nawabpur Godown QC Station (rma_hold location)]
       │
       ▼
[Technician verifies defect] ──► [Replacement dispatched within 24h / Refund issued per §3.14]
```

### Flow 10: Authentic Brand Distributor Warranty Escalation
```
[Customer submits warranty claim for Authentic product after 30 days]
       │
       ▼
[System displays official service center location & contact details]
       │
       ▼
[Customer selects "NCAMart Assisted Warranty Transit"]
       │
       ▼
[NCAMart liaison runner batches units and delivers to distributor (Star Tech/Ryans/Excel)]
       │
       ▼
[Distributor inspects, repairs/replaces unit]
       │
       ▼
[NCAMart receives unit back & couriers repaired item to customer]
```

### Flow 11: Courier COD Settlement Reconciliation
```
[Courier marks parcel DELIVERED] ──► [Ledger: COD receivable from courier]
       │
       ▼
[Courier payout arrives (API sync or Finance uploads CSV)]
       │
       ▼
[System matches each consignment: collected COD, delivery/COD/return charges]
       ├── [Exact match] ──► Receivable cleared; fees booked as expenses
       └── [Mismatch / Missing after 7 days] ──► Exception queue → Finance follows up with courier
```

### Flow 12: Runner Cash Float Day Cycle
```
[Shift start: Finance issues float to runner]
       │
       ▼
[Runner records each purchase (amount, stall, receipt photo) — online or offline]
       │
       ▼
[Shift end: Runner returns unused cash; Finance counts]
       │
       ├── [Variance = 0] ──► Session closed
       └── [Variance ≠ 0] ──► Sourcing Manager + Finance sign-off; logged per runner
```

### Flow 13: Refund Execution
```
[Refund trigger (cancellation / stockout / RMA / pre-order failure)]
       │
       ▼
[Approval by limit: Support ≤ ৳1,000 · Finance ≤ ৳20,000 · Super Admin above]
       │
       ▼
[Online payment? ──Yes──► SSLCommerz refund API]
       │ No / not supported
       ▼
[Finance manual bKash/Nagad/bank payout + reference & proof]
       │
       ▼
[Ledger entry posted; customer notified (Class A); money received within 7 working days]
```

---

## 5. Out of Scope (Phase 1 / MVP)

1. **Open Multi-Vendor Marketplace:** Third-party sellers cannot list items. All stock is curated and QC-inspected by NCAMart.
2. **Automated International Dropshipping:** Direct shipping from overseas suppliers to end consumers without Nawabpur physical QC is strictly prohibited.
3. **Complex B2B Credit Financing:** Wholesale line-of-credit or net-30 billing for contractors is reserved for Phase 2.
4. **Custom Hardware POS Terminals:** Showroom counter sales use the responsive web-based admin portal rather than dedicated POS hardware (standalone bank card terminals are used without integration).
5. **Bank EMI Gateways:** Institutional installment plans deferred to Phase 2; Phase 1 uses the progressive deposit model.
6. **Native Mobile Apps (Android/iOS):** Mobile-first responsive web application (PWA-ready). Native apps reserved for Phase 2.
7. **Unified Mixed-Cart Splitting Engine:** MVP enforces separate checkouts for Pre-Order and regular items to eliminate logistics friction.
8. **External Accounting Software Integration:** The ledger is in-house; Phase 1 provides CSV/Excel exports only.

---

## 6. Non-Functional & Operational Requirements

- **Performance & Mobile Responsiveness:** Mobile-first architecture optimized for Bangladesh mobile 4G/3G networks. Targets: FCP < 1.2s, LCP < 2.5s on 4G, Lighthouse mobile score ≥ 85.
- **Capacity Assumption (Phase 1):** Designed for 500 orders/day and 200 concurrent users, with 5× headroom. To be revisited with real traffic data.
- **Security & Anti-Fraud Architecture:**
  - SSLCommerz hosted checkout redirect; zero local card credential storage.
  - Cryptographically randomized Crockford Base32 Seal IDs (`NCA-XXXX-XXXX`) to eliminate sequential ID enumeration.
  - Rate limiting on OTP, login, checkout, pickup PIN, and `/verify` endpoints (CGNAT-safe, §3.2).
  - Sensitive customer PII masking on runner mobile interfaces.
  - 5% supervisor random inspection quota on sealed packages.
  - TOTP 2FA for all staff; revocable sessions.
- **Data Integrity & Traceability:** Immutable (append-only, tamper-evident) records for Seal IDs, QC test results, serial bindings, warranty timestamps, stock movements, journal entries, and audit logs.
- **Localization:** Bilingual UI (Bangla & English). Bangla UI uses Bangla numerals (৳১,২০০); English UI and invoices use Latin numerals. **All pricing in BDT (৳) only.**
- **Accessibility:** Storefront key flows (browse, checkout, `/verify`, RMA) meet WCAG 2.1 AA.
- **Reliability:** 99.5% uptime SLA. RPO ≤ 5 minutes, RTO ≤ 2 hours. Daily automated database backups with 30-day retention and point-in-time recovery (PITR); monthly restore drill.
- **Environments & Quality:** Separate local, staging (SSLCommerz and courier sandboxes), and production environments; automated unit tests for money, deposit, and state-machine logic and end-to-end tests for checkout; secrets never stored in the code repository.
- **SEO & Discovery:** Server-side rendered (SSR) product pages with structured JSON-LD Schema (`Product`, `Offer`, `Brand`, `Breadcrumbs`) and `hreflang` for Bangla/English.

---

## 7. Data Model (High-Level Schema Entities)

*All monetary fields (`*_bdt`) are stored as integer paisa.*

| Entity | Key Fields |
| :--- | :--- |
| **Product** | id, name_bn, name_en, category, tier (`authentic` / `budget_smart`), fulfilment_model (`drop_pack` / `pre_order`), comparison_group_id, btrc_cleared (bool), vat_rate_pct, status (`draft`/`pending_review`/`approved`/`rejected`/`published`/`archived`) |
| **Variant / SKU** | id, product_id, sku_code, price_bdt, base_cost_bdt, spot_buffer_pct, weight_g |
| **Supplier** | id, name, market (Nawabpur/Sundarban/Stadium/Patuatuli/Import), stall_no, phone, defect_score, status (`active`/`suspended`) |
| **SupplierStock** | supplier_id, sku_id, status (`available`/`limited`/`out`), daily_order_cap (nullable), updated_at |
| **Location** | id, type (`godown`/`showroom`/`qc_hold`/`rma_hold`/`damaged`/`in_transit`), name |
| **InventoryBalance** | sku_id, location_id, on_hand, reserved |
| **StockReservation** | id, order_id, sku_id, location_id, qty, expires_at, status (`active`/`committed`/`released`) |
| **StockMovement** | id, sku_id, from_location_id, to_location_id, qty, reason, ref_type, ref_id, unit_cost_bdt, staff_id, created_at (append-only) |
| **Customer** | id, phone (verified), name, email (optional), delivered_order_count, rto_count_12m, cod_blocked (bool), last_active_at |
| **Address** | id, customer_id, division, district, thana, area, address_line, contact_phone |
| **Order** | id, order_number, customer_id, order_type (`regular`/`pre_order`), status, payment_status, fulfilment_channel (`courier`/`pickup`/`walk_in`), delivery_zone, address_snapshot, subtotal_bdt, discount_bdt, delivery_fee_bdt, advance_fee_paid, cod_amount_bdt, coupon_id, store_credit_applied_bdt, mushak_requested (bool), buyer_bin, pickup_pin_hash (nullable) |
| **OrderItem** | id, order_id, sku_id, qty, unit_price_bdt, allocated_discount_bdt, vat_rate_pct, source (`physical`/`virtual`), seal_id (nullable) |
| **OrderStatusHistory** | id, order_id, from_status, to_status, actor, reason, created_at |
| **PreOrder** | id, order_id, deposit_bdt, balance_bdt, milestone, eta_date, price_locked_bdt, balance_due_date, forfeiture_date, repricing_status |
| **PaymentTransaction** | tran_id (unique), order_id, purpose (`full`/`deposit`/`balance`/`advance_fee`), amount_bdt, method, status, val_id, risk_level, raw_payload |
| **Refund** | id, order_id, payment_tran_id (nullable), amount_bdt, reason, method (`gateway`/`bkash`/`nagad`/`bank`/`store_credit`), status, approved_by, executed_by, external_ref, proof_url |
| **Coupon** | id, code, type (`fixed`/`percent`), value, min_order_bdt, max_discount_bdt, scope, starts_at, ends_at, usage_limit, per_phone_limit, status |
| **StoreCreditEntry** | id, customer_id, delta_bdt, reason, withdrawable (bool), expires_at (nullable), ref_type, ref_id |
| **Invoice** | id, order_id, invoice_no, mushak_serial (nullable, gapless per fiscal year), fiscal_year, vat_total_bdt, pdf_url |
| **CourierShipment** | id, order_id, courier, consignment_no, direction (`forward`/`reverse`), status, expected_cod_bdt, collected_cod_bdt, charges_bdt, last_event_at |
| **CourierSettlement / Line** | settlement: id, courier, payout_ref, payout_date, net_bdt, source (`api`/`csv`); line: consignment_no, shipment_id, collected_bdt, delivery_charge_bdt, cod_charge_bdt, return_charge_bdt, match_status |
| **GatewaySettlement / Line** | settlement: id, payout_ref, payout_date, net_bdt; line: tran_id, amount_bdt, fee_bdt, match_status |
| **RunnerTask** | id, order_id (nullable), task_type (`sourcing`/`supplier_return`/`warranty_liaison`), sku_id, qty, supplier_id, backup_supplier_id, max_unit_price_bdt, runner_id, status |
| **RunnerFloatSession** | id, runner_id, issued_bdt, purchases_bdt, returned_bdt, variance_bdt, status, opened_by, closed_by |
| **RunnerPurchase** | id, client_mutation_id (unique), task_id, float_session_id, supplier_id, amount_bdt, payment_mode (`cash`/`supplier_credit`), receipt_media_id, sync_status (`ok`/`conflict`/`quarantined`) |
| **CashDrawerSession** | id, staff_id, opening_float_bdt, expected_cash_bdt, counted_cash_bdt, variance_bdt, status |
| **LedgerAccount** | id, code, name, type (`asset`/`liability`/`equity`/`income`/`expense`) |
| **JournalEntry / Line** | entry: id, event_type, source_type, source_id, posted_at, posted_by, reversal_of; line: account_id, sub_ledger_ref, debit_bdt, credit_bdt |
| **SealRecord** | seal_id (Crockford Base32), sku_id, manufacturer_serial (nullable), order_item_id, technician_id, warranty_start, warranty_end, status (`generated`/`printed`/`active`/`void_print_error`/`claimed`/`expired`), void_reason |
| **SealVerification** | id, seal_id, device_id, ip, geo_district, created_at |
| **QCRecord** | id, seal_id, qc_type (`3_point` / `non_invasive` / `full`), test_checklist (json), result (`pass`/`fail`), technician_id, sampled_for_audit (bool), supervisor_id, supervisor_checked (bool), created_at |
| **WarrantyClaim (RMA)** | id, claim_number, seal_id, customer_id, issue_description, media_asset_ids, status, resolution (`replace`/`repair`/`refund`), reverse_consignment_no |
| **MediaAsset** | id, owner_type, owner_id, kind, storage_key, size_bytes, retention_until |
| **Review** (Phase 1.5) | id, order_item_id, rating, text, status |
| **NotificationLog** | id, recipient, channel, template, class (`A`/`B`/`C`), status, provider, attempts, scheduled_at, sent_at |
| **Staff** | id, name, roles (`super_admin`/`catalog_manager`/`sourcing_manager`/`godown_manager`/`qc_tech`/`dispatch`/`pos`/`runner`/`support`/`finance`), totp_enabled |
| **Session** | token_hash, subject_type (`customer`/`staff`), subject_id, device_label, expires_at, revoked_at |
| **AuditLog** | id, staff_id, action, entity, before_state, after_state, ip, timestamp, prev_hash, hash |

---

## 8. Legal & Regulatory Compliance

1. **Trademarks Act, 2009 Compliance:** Zero tolerance for replicas or counterfeit brand names. Budget Tier SKUs are restricted to unbranded or OEM utility hardware.
2. **Digital Commerce Operation Guidelines (Bangladesh):** Adherence to national rules regarding delivery timelines, refund SLA, truthful disclosure, and escrow compliance for advance payments.
3. **BTRC Regulatory Compliance:** Pre-screening of all imported wireless/RF devices to confirm Type Approval or NOC eligibility before offering them in the pre-order catalog.
4. **NBR Tax Compliance:** Capability to issue National Board of Revenue (NBR) compliant Mushak 6.3 digital tax invoices for B2B/contractor sales.
5. **Business Licensing:** Active Trade License, e-TIN, BIN (VAT registration), and DBID (Digital Business Identification) with the Ministry of Commerce.
6. **Mandatory Storefront Policies:** Terms & Conditions, Privacy Policy, Return & Refund Policy, Warranty & RMA Terms, Pre-Order Policy (including deposit forfeiture), and clear physical location disclosures.
7. **Open Legal Confirmations (must be closed in Phase 0):**
   - Whether pre-order deposits and other advance payments must be held in escrow, and whether 15–25 day import ETAs fit the Digital Commerce Guidelines' delivery timelines.
   - Applicable VAT rates per category, whether every sale needs a Mushak 6.3, and any EFD/SDC device requirement.
   - Minimum record retention period under VAT and income tax law.
   - Enforceability of the deposit forfeiture clause.

---

## 9. Marketing & Sales Channels
- **Facebook & Instagram Shop:** Automated catalog sync (hourly feed, §3.17) with direct WhatsApp/Messenger shopping assistance.
- **WhatsApp Business Automation:** Instant order confirmation, pre-order milestone tracking, and customer service (pre-approved templates).
- **Content Marketing & SEO:** Educational comparison content (e.g., *"How to spot a fake GaN charger in Dhaka"*), establishing NCAMart as the authority on tech authenticity.
- **Google Merchant Center:** Structured product feed for Google Shopping queries.
- **Physical Walk-In QR Integration:** Standees at Nawabpur Complex showroom driving traffic to `/verify` and online pre-orders.

---

## 10. Risks, Mitigations & Exceptions Matrix

| Risk / Exception Factor | Severity | Strategic Mitigation & Escalation Protocol |
| :--- | :---: | :--- |
| **Wholesale spot price increase** | Medium | Per-SKU 5%–7% price tolerance buffer; automated approval escalation to Sourcing Manager (§3.4). |
| **Import / customs clearance delay** | High | Pre-screen BTRC NOC requirements (§3.3); conservative ETAs (15–25 days); proactive milestone alerts. If delay > 7 days, offer ৳1,000 store credit (§3.14) or instant 100% refund. |
| **USD/BDT exchange rate spikes (> 8%)** | High | Landed price includes 5%–8% currency buffer. Re-Pricing Approval Ticket issued; customer may accept adjusted price or cancel with 100% refund. |
| **High COD return-to-origin (RTO)** | High | Mandatory phone OTP; advance delivery fee (৳80/৳150 via SSLCommerz) for first-time buyers; `rto_count_12m >= 2` blocks COD. |
| **Seal peeling & warranty fraud** | High | Destructive VOID security stickers (§3.2); immutable QC dispatch logging; cloned seal anomaly alerts. |
| **Mixed-order fulfillment conflicts** | Medium | Separate checkout flows for Pre-Order vs. Drop-and-Pack items (`ERR_MIXED_CART_DISALLOWED`). |
| **Showroom vs. Online stock collision** | Medium | Shared physical inventory with 10-minute reservations (§3.11); POS sales decrement the same balance instantly. |
| **Supplier batch defect failure** | Medium | If 3 of 5 units fail QC, entire batch is returned for cash/exchange; supplier defect score increases; stalls > 3% defect rate are delisted. |
| **Courier loss or transit damage** | Medium | Immediate replacement dispatched to customer within 24 hours of unboxing video; NCAMart handles courier insurance claim internally. |
| **Distributor warranty refusal** | High | NCAMart 100% Authentic Guarantee SLA activates: NCAMart assumes full financial liability, issuing new replacement or refund within 48h. |
| **Courier COD remittance shortfall** | High | Per-consignment settlement matching, exception queue, 7-day aging alerts (§3.13). |
| **Runner cash leakage** | Medium | Daily float sessions, receipt photos, variance sign-off and per-runner reporting (§3.13.4). |
| **Phone number recycling** | Medium | 12-month dormancy ownership check; warranties bound to Seal ID (§3.5). |

---

## 11. Release Roadmap & Action Plan

| Phase | Milestone Scope | Target Timeline | Priority Focus |
| :--- | :--- | :---: | :---: |
| **Phase 0 — Foundation** | Business licensing (DBID/BIN), supplier vendor onboarding, thermal VOID seal sourcing, brand design system, legal confirmations (§8.7), integration verification checklist (architechture.md) | Weeks 1–3 | **P0** Security & Legal |
| **Phase 1 — MVP Launch** | Two-tier catalog with governance, comparison module, search, SSLCommerz gateway (bKash/Cards/COD), separate checkout flows, physical/virtual inventory, order state machines, `/verify` portal, admin godown QC & thermal label printing, courier API, showroom POS (pickup & walk-in), RTO workflow, finance ledger, COD & gateway reconciliation, runner float, refunds, store credit, coupons, analytics & feeds | Weeks 4–12 | **P0 & P1** Core Operations |
| **Phase 1.5 — Pre-Order Engine** | Milestone tracking, BTRC pre-screened import catalog, progressive deposit engine, 7-day default forfeiture workflow, WhatsApp automation, verified reviews, wishlist, back-in-stock & abandoned cart | Weeks 13–16 | **P1 & P2** Scaling Trust |
| **Phase 2 — Growth & Scaling** | Bank EMI integrations, native mobile apps (Android/iOS), B2B contractor credit accounts, private-label branding, accounting software integration, second app server | Month 5+ | **P3** Expansion |

*v1.4 note: Phase 1 is extended by 2 weeks (Weeks 4–10 → 4–12) to fit the inventory, finance, and refund modules; later phases shift accordingly.*

---

## 12. Architectural & Operational Decisions (Resolved)

1. **Pre-Order Deposit Structure:** **Progressive** — 20% of the first ৳50,000 of the unit price plus 10% of any amount above ৳50,000, rounded up to ৳10. Effective rate 10%–20% with no price cliff. Balance via COD only up to ৳30,000 (configurable).
2. **Primary Payment Gateway:** **SSLCommerz** (integrating direct bKash, Nagad, Rocket, Visa, Mastercard, and AmEx).
3. **Budget Tier Branding:** Initially labeled purely as **"Budget Smart (Tested OEM)"**. No replicas permitted. (Private label deferred to Phase 2).
4. **Exchange Rate Fluctuation Threshold:** Landed pricing includes a built-in currency buffer (5%–8%); if exchange rate devaluation exceeds 8%, price is updated with customer approval or a 100% refund is issued.
5. **Authentic Tier Extended Warranty:** **No.** Authentic items rely strictly on official manufacturer/distributor warranties; no shop add-on warranty will be sold.
6. **Tech Stack & Infrastructure:** **Next.js full-stack (App Router) modular monolith + separate background worker process, PostgreSQL 16 (Drizzle ORM), Redis 7 + BullMQ, custom admin inside the same app**, deployed on a Singapore-region VPS with managed PostgreSQL. Details in [architechture.md](./architechture.md).
7. **Finance:** In-house double-entry ledger with courier COD, gateway, runner float, and cash drawer reconciliation.
8. **Inventory:** Physical vs. virtual stock; 10-minute reservations on physical stock, stored in PostgreSQL.
9. **Notifications:** Three classes (A 24/7, B 08:00–22:00 courtesy window, C promotional opt-in 08:00–22:00).
10. **RBAC:** 10 staff roles + Guest/Customer, TOTP for all staff.
11. **Money Representation:** Integer paisa internally; BDT only.

---

## 13. Superseded Values (vs. requirement-validation.md)

Where [requirement-validation.md](./requirement-validation.md) states a different value, **this PRD (v1.4) wins**:

| Topic | requirement-validation.md | PRD v1.4 |
| :--- | :--- | :--- |
| Deposit formula | 10% if price ≥ ৳50k, else 20% | Progressive formula (§3.3.2) |
| Notification windows | 09:00–21:00 for some events | Classes A/B/C (§3.10) |
| RMA media size | 15 MB total | Photos 5 × 10 MB, video 300 MB (§3.8) |
| Currency storage | decimal(10,2) | Integer paisa (§3.6) |
| `/verify` rate limit | 5/min per IP | 5/min per device + 60/min per IP (§3.2) |
| Cloned seal trigger | Many distinct IPs | ≥ 5 devices across ≥ 2 districts in 24h (§3.2) |
| Inventory lock | Redis lock | PostgreSQL reservations on physical stock (§3.11) |
| RBAC | 8 roles | Guest, Customer + 10 staff roles (§3.9) |
| RMA status notification | Within 2 hours | Within 1 hour (§3.10) |
| Seal ID regex | `[A-Z0-9]` | Crockford Base32 regex (§3.2) |
| Refund timing | Various (24h / 3 days) | Initiated within 24h, received within 7 working days max (§3.14) |
| RTO count | Lifetime | Rolling 12 months (§3.6) |
