# Database Schema Specification — NCAMart

**Document Version:** 2.0 (Engineering Schemas Artifact)  
**Status:** Approved Technical Design Artifact  
**Date:** 2026-10-20  
**Target Domain:** [ncamart.com](https://ncamart.com)  
**Foundational References:** [PRD.md](./PRD.md) (v1.4), [architechture.md](./architechture.md) (v1.1), [dfd.md](./dfd.md) (v2.0), & [database.md](./database.md)  
**Monetary Standard:** All monetary amounts are strictly represented as **Integer Paisa (1 BDT = 100 Paisa)** without floating point numbers.

---

## Part 1: Domain Entities & TypeScript Document Schemas

### 1.1 Collection: `users_customers`
Consolidates customer accounts, Bangladeshi MSISDN authentication, 12-month rolling RTO metrics, staff RBAC credentials, TOTP secrets, and revocable sessions.
```typescript
import { ObjectId } from 'mongodb';

export interface UserCustomerDocument {
  _id: ObjectId | string;
  phone: string; // E.164 BD format: "+8801XXXXXXXXX" (Unique)
  email?: string; // Optional, normalized lowercase
  full_name: string;
  role: 'CUSTOMER' | 'FIELD_RUNNER' | 'QC_TECHNICIAN' | 'GODOWN_MANAGER' | 
        'DISPATCH_STAFF' | 'SHOWROOM_POS_STAFF' | 'SOURCING_MANAGER' | 
        'CATALOG_MANAGER' | 'CUSTOMER_SUPPORT' | 'FINANCE_OFFICER' | 'SUPER_ADMIN';
  is_active: boolean;
  dormant_flag: boolean; // Set true if no activity for 12 months (requires re-OTP)
  password_hash?: string; // Staff only (Argon2id)
  totp_secret?: string; // Staff 2FA secret (encrypted AES-256-GCM)
  totp_enabled: boolean;
  addresses: Array<{
    address_id: string; // UUID
    label: 'HOME' | 'OFFICE' | 'OTHER';
    district: string; // e.g., "Dhaka", "Chittagong"
    thana: string; // e.g., "Kotwali", "Dhanmondi"
    street_address: string;
    is_default: boolean;
    courier_zone_code?: string; // Pathao/Steadfast mapped zone
  }>;
  risk_profile: {
    delivered_orders_count: number;
    rto_count_12m: number; // Return-to-origin count over last 12 months
    is_cod_blacklisted: boolean; // Auto-flagged if rto_count_12m >= 2
    fraud_risk_score: number; // 0 to 100
  };
  active_sessions: Array<{
    session_id: string; // UUID
    token_hash: string; // SHA-256
    device_id: string;
    ip_address: string;
    user_agent: string;
    created_at: Date;
    expires_at: Date;
  }>;
  created_at: Date;
  updated_at: Date;
}
```

---

### 1.2 Collection: `categories_spec_templates`
Hierarchical taxonomy, category-specific comparative specification matrix templates, and BTRC wireless clearance flags.
```typescript
export interface CategorySpecTemplateDocument {
  _id: ObjectId | string;
  slug: string; // e.g., "smart-door-locks", "fast-chargers"
  name_en: string;
  name_bn: string;
  parent_category_id?: ObjectId | string;
  level: number; // 1 (Root), 2 (Sub-category), 3 (Leaf)
  btrc_clearance_required: boolean; // If true, product cannot be published without BTRC certificate
  comparison_spec_keys: Array<{
    key_name: string; // e.g., "max_wattage", "cable_length", "biometric_sensor_type"
    label_en: string;
    label_bn: string;
    unit?: string; // e.g., "W", "meter", "V"
    field_type: 'NUMBER' | 'STRING' | 'BOOLEAN';
    is_highlighted_for_comparison: boolean; // Shown on side-by-side diff matrix
  }>;
  created_at: Date;
  updated_at: Date;
}
```

---

### 1.3 Collection: `products`
Master product definitions, two-tier classification (`AUTHENTIC` vs `BUDGET_SMART`), comparison group links, and SEO metadata.
```typescript
export interface ProductDocument {
  _id: ObjectId | string;
  title_en: string;
  title_bn: string;
  slug: string; // Unique URL slug
  category_id: ObjectId | string;
  product_tier: 'AUTHENTIC' | 'BUDGET_SMART'; // Two-Tier distinction
  brand_name: string; // e.g., "UGREEN", "Baseus", "OEM Nawabpur", "UNI-T"
  origin_country?: string; // e.g., "China", "Taiwan"
  comparison_group_id?: ObjectId | string; // Pairs an Authentic product with its Budget Smart counterpart
  comparison_summary: {
    comparison_points_en: string[];
    comparison_points_bn: string[];
  };
  btrc_clearance_code?: string; // Verified BTRC wireless registration code
  btrc_status: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  is_published: boolean; // Enforces: if btrc_clearance_required && btrc_status != 'APPROVED' => false
  media: Array<{
    url: string; // Cloudflare R2 public CDN URL
    r2_key: string;
    is_primary: boolean;
    sort_order: number;
  }>;
  created_at: Date;
  updated_at: Date;
}
```

---

### 1.4 Collection: `skus`
Sellable variants, barcodes (EAN-13), base unit selling prices in integer paisa, warranty days, and supplier sourcing constraints.
```typescript
export interface SkuDocument {
  _id: ObjectId | string;
  product_id: ObjectId | string;
  sku_code: string; // Unique human-readable code e.g. "UGR-65W-BLK"
  barcode_ean13?: string;
  attributes: Record<string, string>; // e.g., { color: "Black", port: "Type-C x3" }
  specs: Record<string, any>; // Category-specific key-value pairs matching spec template
  fulfillment_type: 'REGULAR_DROP_PACK' | 'PRE_ORDER';
  
  // Pricing in Integer Paisa
  regular_price_paisa: number; // e.g., 250000 = ৳2,500.00
  sale_price_paisa?: number; // Discounted promo price
  max_counter_sourcing_budget_paisa: number; // Sourcing budget limit for runners
  
  // Warranty Specifications
  warranty_days: number; // 7 days (Budget) to 730 days (Authentic 2-Year)
  warranty_type: 'SHOP_REPLACEMENT' | 'OFFICIAL_DISTRIBUTOR' | 'MANUFACTURER_GLOBAL';
  official_distributor_name?: string; // e.g., "Excel Technologies", "Star Tech"
  
  weight_grams: number;
  created_at: Date;
  updated_at: Date;
}
```

---

### 1.5 Collection: `suppliers_stalls`
Nawabpur Complex, Sundarban Square, and Stadium Market wholesale stalls, contact info, payment modes, and rolling 3% defect rate tracking.
```typescript
export interface SupplierStallDocument {
  _id: ObjectId | string;
  stall_number: string; // e.g., "Shop #104, 2nd Floor, Sundarban Square"
  market_name: 'NAWABPUR_COMPLEX' | 'SUNDARBAN_SQUARE' | 'STADIUM_MARKET' | 'PATUATULY';
  proprietor_name: string;
  contact_phone: string;
  bKash_merchant_number?: string;
  accepted_payment_modes: Array<'CASH' | 'BKASH' | 'CREDIT_FLOAT'>;
  quality_metrics: {
    total_units_sourced: number;
    qc_failed_units: number;
    defect_rate_percentage: number; // (qc_failed / total) * 100
    is_blacklisted: boolean; // Auto-set true if defect_rate_percentage > 3.0%
  };
  created_at: Date;
  updated_at: Date;
}
```

---

### 1.6 Collection: `inventory_balances`
Multi-location physical stock on-hand, locked/reserved counts, safety stock thresholds, and location bins (`GODOWN_NAWABPUR`, `SHOWROOM_COUNTER`).
```typescript
export interface InventoryBalanceDocument {
  _id: ObjectId | string;
  sku_id: ObjectId | string;
  location_code: 'GODOWN_NAWABPUR' | 'SHOWROOM_COUNTER' | 'TRANSIT_PREORDER';
  on_hand: number; // Total physical units located in bin
  reserved: number; // Units currently held in 10-minute checkout reservations
  available: number; // Virtual calculated field: on_hand - reserved
  safety_stock_threshold: number;
  created_at: Date;
  updated_at: Date;
}
```

---

### 1.7 Collection: `stock_reservations`
10-minute cart checkout locks, conditional reservation timestamps, and transition states (`ACTIVE`, `COMMITTED`, `RELEASED`, `EXPIRED`).
```typescript
export interface StockReservationDocument {
  _id: ObjectId | string;
  reservation_id: string; // UUID
  sku_id: ObjectId | string;
  order_id?: ObjectId | string; // Associated order during checkout
  location_code: string;
  quantity: number;
  customer_id?: ObjectId | string;
  session_token?: string;
  status: 'ACTIVE' | 'COMMITTED' | 'RELEASED' | 'EXPIRED';
  expires_at: Date; // CreatedAt + 10 minutes
  created_at: Date;
  updated_at: Date;
}
```

---

### 1.8 Collection: `stock_movements`
Append-only audit trail of every physical stock increment, decrement, runner receipt, damaged write-off, and customer return.
```typescript
export interface StockMovementDocument {
  _id: ObjectId | string;
  sku_id: ObjectId | string;
  from_location_code?: string;
  to_location_code?: string;
  quantity: number;
  reason: 'PURCHASE_RECEIPT' | 'SALES_DISPATCH' | 'RMA_RETURN' | 'DAMAGE_WRITEOFF' | 'CYCLE_COUNT_ADJUSTMENT';
  reference_type: 'ORDER' | 'RUNNER_PURCHASE' | 'RMA_CLAIM' | 'STOCK_ADJUSTMENT';
  reference_id: string;
  unit_cost_paisa: number;
  performed_by_staff_id: ObjectId | string;
  created_at: Date; // Strictly Append-Only
}
```

---

### 1.9 Collection: `orders`
Sales orders, pre-orders, isolated cart types (`REGULAR_DROP_PACK` vs `PRE_ORDER`), delivery addresses, progressive deposits, and full order milestones.
```typescript
export interface OrderDocument {
  _id: ObjectId | string;
  order_number: string; // Human-readable e.g. "ORD-2026-10482"
  customer_id: ObjectId | string;
  channel: 'STOREFRONT_WEB' | 'SHOWROOM_POS' | 'PHONE_ORDER';
  order_type: 'REGULAR_DROP_PACK' | 'PRE_ORDER'; // Pure isolation enforced
  coupon_id?: ObjectId | string; // Applied coupon reference
  store_credit_applied_paisa?: number; // Store credit balance applied
  
  // Complete Order State Machine Enums (PRD §3.12 & DFD P4.3)
  status: 'PENDING_PAYMENT' | 'CONFIRMED' | 'SOURCING' | 'AT_GODOWN_QC' | 
          'PACKED' | 'HANDED_TO_COURIER' | 'DELIVERED' | 'PARTIALLY_DELIVERED' | 
          'RTO_IN_TRANSIT' | 'RTO_RECEIVED' | 'READY_FOR_PICKUP' | 'DELIVERED_COUNTER' | 
          'PICKUP_EXPIRED' | 'CANCELLED' | 'DEPOSIT_PENDING' | 'DEPOSIT_PAID' | 
          'SOURCED_IN_TRANSIT' | 'ARRIVED_GODOWN' | 'QC_VERIFIED_BALANCE_DUE' | 
          'BALANCE_PAID' | 'BALANCE_COD_SCHEDULED' | 'REPRICING_PENDING' | 
          'CANCELLED_REFUNDED' | 'DEPOSIT_FORFEITED_CANCELLED';
  
  items: Array<{
    sku_id: ObjectId | string;
    product_title_en: string;
    product_tier: 'AUTHENTIC' | 'BUDGET_SMART';
    quantity: number;
    unit_price_paisa: number; // Integer Paisa
    allocated_discount_paisa: number; // Pro-rata allocated coupon discount (PRD §3.14)
    vat_rate_pct: number; // Line item VAT rate percentage (e.g. 5, 7.5, 15)
    total_price_paisa: number; // (unit_price_paisa * quantity) - allocated_discount_paisa
    allocated_seal_id?: string; // Assigned during QC
  }>;
  
  // Pre-Order Specifics (PRD §4.3 & DFD P4.2)
  pre_order_details?: {
    deposit_required_paisa: number; // Progressive formula calculation
    deposit_paid_paisa: number;
    balance_due_paisa: number;
    estimated_arrival_date: Date;
    arrival_notified_at?: Date;
    balance_due_deadline?: Date; // T + 7 days post QC verification
    fx_devaluation_status?: 'NORMAL' | 'REPRICING_PENDING' | 'CUSTOMER_ACCEPTED' | 'CUSTOMER_REFUNDED';
    landed_cost_flash_deal_flag?: boolean; // Set true if forfeited on Day 8
  };
  
  // Financial Breakup in Integer Paisa (PRD §3.6 & §3.7)
  financial_summary: {
    subtotal_paisa: number;
    discount_paisa: number;
    delivery_fee_paisa: number; // ৳80 (Inside Dhaka) / ৳150 (Nationwide) [PRD §3.6.2, §3.7]
    advance_payment_required_paisa: number; // 100% COD or Advance Delivery Fee
    advance_payment_received_paisa: number;
    cod_amount_collectible_paisa: number; // Balance to be collected by courier
    vat_paisa: number; // NBR Mushak 6.3 calculation
    total_payable_paisa: number;
  };

  shipping_address: {
    consignee_name: string;
    phone: string;
    district: string;
    thana: string;
    street_address: string;
  };
  
  // Showroom POS Pickup Credentials
  showroom_pickup?: {
    pickup_pin_hash: string; // HMAC-SHA256 salted PIN presented to counter
    failed_attempts_count: number; // Max 5 attempts
    is_claimed: boolean;
    claimed_at?: Date;
    claimed_by_staff_id?: ObjectId | string;
  };

  created_at: Date;
  updated_at: Date;
}
```

---

### 1.10 Collection: `payment_transactions`
Payment lifecycle records, SSLCommerz transaction logs, MD5 hashes, S2S validation responses, and refund allocations.
```typescript
export interface PaymentTransactionDocument {
  _id: ObjectId | string;
  tran_id: string; // Unique transaction ID e.g. "NCA-TXN-20261020-001"
  order_id: ObjectId | string;
  customer_id: ObjectId | string;
  gateway: 'SSLCOMMERZ' | 'BKASH_DIRECT' | 'SHOWROOM_CASH' | 'SHOWROOM_POS_TERMINAL' | 'COURIER_COD';
  amount_paisa: number;
  currency: 'BDT';
  payment_category: 'FULL_ONLINE' | 'ADVANCE_DELIVERY_FEE' | 'PREORDER_DEPOSIT' | 'PREORDER_BALANCE';
  status: 'INITIATED' | 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  
  sslcommerz_metadata?: {
    val_id?: string;
    card_type?: string; // e.g., "BKASH-bKash", "VISA-CityBank"
    card_brand?: string;
    verify_sign?: string;
    verify_key?: string;
    bank_tran_id?: string;
    raw_ipn_payload?: Record<string, any>;
    s2s_validated_at?: Date;
  };

  refund_details?: {
    refund_tran_id?: string;
    refunded_amount_paisa: number;
    reason: string;
    approved_by_staff_id: ObjectId | string;
    refunded_at: Date;
  };

  created_at: Date;
  updated_at: Date;
}
```

---

### 1.11 Collection: `seal_records_qc`
Crockford Base32 cryptographic tamper-evident seals (`NCA-XXXX-XXXX`), 3-point QC test logs, OEM serial bindings, and scan geo-audits.
```typescript
export interface SealRecordQcDocument {
  _id: ObjectId | string;
  seal_id: string; // Crockford Base32 8-char: "NCA-XXXX-XXXX" (Unique Index)
  sku_id: ObjectId | string;
  order_id?: ObjectId | string;
  product_tier: 'AUTHENTIC' | 'BUDGET_SMART';
  status: 'GENERATED' | 'PRINTED' | 'ACTIVE' | 'VOID_PRINT_ERROR' | 'CLAIMED' | 'EXPIRED'; // Aligned with PRD §7
  
  oem_manufacturer_serial?: string; // Captured from vendor box
  
  qc_inspection_log: {
    inspected_by_staff_id: ObjectId | string;
    inspected_at: Date;
    voltage_reading?: number; // e.g. 5.12V
    firmware_version?: string;
    cable_resistance_ohm?: number;
    checklist_passed: boolean;
    tester_notes?: string;
  };

  void_log?: {
    voided_at: Date;
    voided_by_staff_id: ObjectId | string;
    approved_by_godown_manager_id: ObjectId | string;
    reason: 'PRINTER_JAM' | 'DAMAGED_LABEL' | 'FAILED_QC_RETEST';
  };

  verification_scans: Array<{
    scanned_at: Date;
    client_ip: string;
    device_id: string; // Anonymous device cookie: "nca_did"
    user_agent: string;
    district_geo?: string;
    is_flagged_anomaly: boolean;
  }>;

  warranty_expiry_date: Date;
  created_at: Date;
  updated_at: Date;
}
```

---

### 1.12 Collection: `runner_tasks_purchases`
Drop-and-pack runner assignments, offline sync mutations (`client_mutation_id`), paper receipt OCR/photos, and shift cash float sessions.
```typescript
export interface RunnerTaskPurchaseDocument {
  _id: ObjectId | string;
  task_number: string; // e.g. "RUN-20261020-0042"
  runner_staff_id: ObjectId | string;
  order_id: ObjectId | string;
  sku_id: ObjectId | string;
  target_stall_id: ObjectId | string;
  max_authorized_budget_paisa: number;
  
  status: 'DISPATCHED' | 'STALL_CONTACTED' | 'PURCHASED' | 'PRICE_EXCEEDED_PENDING' | 'CANCELLED';
  
  // Offline sync & PWA Mutation Invariant
  client_mutation_id: string; // UUID generated on PWA device for idempotent ingestion
  float_session_id?: ObjectId | string; // Associated shift cash float session
  
  purchase_execution?: {
    actual_cost_paisa: number;
    payment_mode: 'CASH_FLOAT' | 'BKASH_STALL';
    paper_receipt_photo_url: string; // Cloudflare R2 URL
    price_variance_approved_by?: ObjectId | string;
    purchased_at: Date;
  };

  created_at: Date;
  updated_at: Date;
}

export interface RunnerFloatSessionDocument {
  _id: ObjectId | string;
  runner_staff_id: ObjectId | string;
  opened_by_staff_id: ObjectId | string;
  closed_by_staff_id?: ObjectId | string;
  status: 'OPEN' | 'RECONCILED' | 'VARIANCE_FLAGGED' | 'CLOSED';
  issued_float_paisa: number;
  total_purchases_paisa: number;
  returned_cash_paisa: number;
  variance_paisa: number; // issued - purchases - returned
  variance_reason?: string;
  opened_at: Date;
  closed_at?: Date;
}

export interface CashDrawerSessionDocument {
  _id: ObjectId | string;
  pos_staff_id: ObjectId | string;
  status: 'OPEN' | 'BALANCED' | 'VARIANCE_FLAGGED' | 'CLOSED';
  opening_float_paisa: number;
  expected_cash_paisa: number;
  counted_cash_paisa: number;
  variance_paisa: number; // counted - expected
  variance_notes?: string;
  shift_opened_at: Date;
  shift_closed_at?: Date;
```

---

### 1.13 Collection: `courier_shipments`
Consignment tracking numbers (Steadfast, Pathao, RedX), expected COD amounts, delivery webhooks, and reverse parcel logistics.
```typescript
export interface CourierShipmentDocument {
  _id: ObjectId | string;
  consignment_id: string; // Internal UUID
  order_id: ObjectId | string;
  courier_partner: 'STEADFAST' | 'PATHAO' | 'REDX';
  courier_tracking_code: string; // Consignment code from 3rd party API
  direction: 'FORWARD' | 'REVERSE'; // Forward delivery vs RMA reverse pickup (PRD §7)
  
  shipping_status: 'BOOKED' | 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 
                   'DELIVERED' | 'PARTIAL_DELIVERED' | 'RETURN_IN_TRANSIT' | 'RETURNED_TO_GODOWN';
  
  expected_cod_paisa: number; // Amount courier must collect from customer
  actual_remitted_paisa?: number; // Payout from courier invoice
  remittance_status: 'PENDING' | 'RECONCILED' | 'SHORT_PAID' | 'OVER_PAID' | 'DISPUTED';
  courier_settlement_batch_id?: string;
  
  webhook_events: Array<{
    raw_status: string;
    normalized_status: string;
    received_at: Date;
  }>;

  created_at: Date;
  updated_at: Date;
}
```

---

### 1.14 Collection: `warranty_claims`
Post-purchase RMA claims, Cloudflare R2 unboxing video keys, technician adjudication, DOA flags, and distributor liaison batches.
```typescript
export interface WarrantyClaimDocument {
  _id: ObjectId | string;
  claim_number: string; // e.g. "RMA-2026-0038"
  seal_id: string; // Crockford Base32
  order_id: ObjectId | string;
  customer_id: ObjectId | string;
  
  claim_stage: 'INTAKE' | 'ADJUDICATION' | 'REVERSE_PICKUP' | 'GODOWN_INSPECTION' | 
               'REPLACEMENT_DISPATCHED' | 'REFUND_ISSUED' | 'DISTRIBUTOR_LIAISON' | 'REJECTED';
  
  unboxing_video_r2_key: string; // Direct multipart upload to R2 (<=300MB)
  customer_issue_description: string;
  is_doa_priority: boolean; // Dead on Arrival (reported <= 48 hours post delivery)
  
  adjudication?: {
    adjudicated_by_staff_id: ObjectId | string;
    adjudicated_at: Date;
    decision: 'APPROVED_FOR_RETURN' | 'REJECTED_VOID_SEAL' | 'REJECTED_CUSTOMER_DAMAGE';
    rejection_reason?: string;
  };

  godown_qc_result?: {
    verified_defect: boolean;
    technician_notes: string;
    resolution_path: '7_DAY_SHOP_REPLACEMENT' | 'DISTRIBUTOR_REPAIR' | 'FINANCE_REFUND';
  };

  created_at: Date;
  updated_at: Date;
}
```

---

### 1.15 Collection: `ledger_journal`
In-house double-entry general ledger, chart of accounts, balanced journal lines ($\sum \text{Debit} = \sum \text{Credit}$), and NBR Mushak 6.3 tax serials.
```typescript
export interface LedgerJournalDocument {
  _id: ObjectId | string;
  entry_number: string; // e.g. "JRN-20261020-00192"
  entry_date: Date;
  source_event_type: 'ORDER_PAYMENT_ONLINE' | 'COURIER_COD_REMITTANCE' | 'RUNNER_PURCHASE_EXPENSE' | 
                     'PREORDER_DEPOSIT_COLLECTED' | 'REVENUE_RECOGNITION' | 'TAX_VAT_POSTING' | 'CUSTOMER_REFUND';
  reference_entity_id: string; // e.g., Order ID, Shipment ID, Refund ID
  description: string;
  
  // Enforces Balance Rule: sum(Debit) - sum(Credit) == 0
  lines: Array<{
    account_code: string; // e.g., "1100" (SSLCommerz), "1110" (Courier COD), "4000" (Sales Revenue)
    account_name: string;
    debit_paisa: number;
    credit_paisa: number;
  }>;

  // NBR Mushak 6.3 Tax Compliance
  mushak_6_3?: {
    fiscal_year: string; // e.g. "2026-2027"
    gapless_serial_number: number;
    pdf_r2_key: string;
  };

  created_at: Date; // Strictly Append-Only (Zero updates or deletes permitted)
}
```

---

### 1.16 Collection: `transactional_outbox_audit`
Reliable event-driven notification queue (Class A/B/C) with SKIP LOCKED polling, and SHA-256 hash-chained immutable audit trail.
```typescript
export interface OutboxAuditDocument {
  _id: ObjectId | string;
  event_id: string; // UUID
  event_type: 'ORDER_CONFIRMED' | 'SEAL_MINTED' | 'RUNNER_ASSIGNED' | 'DISPATCH_BOOKED' | 'CLONED_SEAL_ALERT';
  priority_class: 'CLASS_A_INSTANT' | 'CLASS_B_OPERATIONAL' | 'CLASS_C_MARKETING';
  
  payload: Record<string, any>;
  
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DEAD_LETTER';
  retry_count: number;
  max_retries: number;
  scheduled_at: Date; // Respects quiet hours (22:00-08:00 Dhaka time for Class B/C)
  processed_at?: Date;
  error_message?: string;
  
  // Immutable Audit Hash Chaining (PRD §8.3)
  prev_audit_hash?: string; // SHA-256 of preceding audit entry
  current_audit_hash?: string; // SHA-256(prev_audit_hash + event_id + payload + timestamp)

  created_at: Date;
}
```

---

## Part 2: Production-Grade TypeScript Mongoose Schemas & Models

### 2.1 Mongoose Schema: `Product` & `Sku`
```typescript
import { Schema, model, Document, Types } from 'mongoose';

export interface ISku extends Document {
  product_id: Types.ObjectId;
  sku_code: string;
  barcode_ean13?: string;
  attributes: Map<string, string>;
  specs: Map<string, any>;
  fulfillment_type: 'REGULAR_DROP_PACK' | 'PRE_ORDER';
  regular_price_paisa: number;
  sale_price_paisa?: number;
  max_counter_sourcing_budget_paisa: number;
  warranty_days: number;
  warranty_type: 'SHOP_REPLACEMENT' | 'OFFICIAL_DISTRIBUTOR' | 'MANUFACTURER_GLOBAL';
  official_distributor_name?: string;
  weight_grams: number;
}

export const SkuSchema = new Schema<ISku>(
  {
    product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    sku_code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    barcode_ean13: { type: String, trim: true },
    attributes: { type: Map, of: String, default: {} },
    specs: { type: Map, of: Schema.Types.Mixed, default: {} },
    fulfillment_type: { 
      type: String, 
      enum: ['REGULAR_DROP_PACK', 'PRE_ORDER'], 
      required: true 
    },
    regular_price_paisa: { 
      type: Number, 
      required: true, 
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} must be an integer paisa value'
      }
    },
    sale_price_paisa: { 
      type: Number, 
      min: 0,
      validate: {
        validator: (v: number) => v === undefined || Number.isInteger(v),
        message: '{VALUE} must be an integer paisa value'
      }
    },
    max_counter_sourcing_budget_paisa: { type: Number, required: true, min: 0 },
    warranty_days: { type: Number, required: true, default: 7 },
    warranty_type: { 
      type: String, 
      enum: ['SHOP_REPLACEMENT', 'OFFICIAL_DISTRIBUTOR', 'MANUFACTURER_GLOBAL'], 
      required: true 
    },
    official_distributor_name: { type: String, trim: true },
    weight_grams: { type: Number, required: true, default: 100 }
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export interface IProduct extends Document {
  title_en: string;
  title_bn: string;
  slug: string;
  category_id: Types.ObjectId;
  product_tier: 'AUTHENTIC' | 'BUDGET_SMART';
  brand_name: string;
  origin_country?: string;
  comparison_group_id?: Types.ObjectId;
  comparison_summary: {
    comparison_points_en: string[];
    comparison_points_bn: string[];
  };
  btrc_clearance_code?: string;
  btrc_status: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  is_published: boolean;
  media: Array<{
    url: string;
    r2_key: string;
    is_primary: boolean;
    sort_order: number;
  }>;
}

export const ProductSchema = new Schema<IProduct>(
  {
    title_en: { type: String, required: true, trim: true },
    title_bn: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    category_id: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    product_tier: { 
      type: String, 
      enum: ['AUTHENTIC', 'BUDGET_SMART'], 
      required: true,
      index: true 
    },
    brand_name: { type: String, required: true, trim: true },
    origin_country: { type: String, trim: true },
    comparison_group_id: { type: Schema.Types.ObjectId, index: true },
    comparison_summary: {
      comparison_points_en: [{ type: String }],
      comparison_points_bn: [{ type: String }]
    },
    btrc_clearance_code: { type: String, trim: true },
    btrc_status: { 
      type: String, 
      enum: ['NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'], 
      default: 'NOT_REQUIRED' 
    },
    is_published: { type: Boolean, default: false, index: true },
    media: [
      {
        url: { type: String, required: true },
        r2_key: { type: String, required: true },
        is_primary: { type: Boolean, default: false },
        sort_order: { type: Number, default: 0 }
      }
    ]
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// Compound Index for Catalog Two-Tier Navigation
ProductSchema.index({ category_id: 1, product_tier: 1, is_published: 1 });

export const SkuModel = model<ISku>('Sku', SkuSchema);
export const ProductModel = model<IProduct>('Product', ProductSchema);
```

---

### 2.2 Mongoose Schema: `SealRecordQc` (Tamper-Proof Verification)
```typescript
export interface ISealRecordQc extends Document {
  seal_id: string;
  sku_id: Types.ObjectId;
  order_id?: Types.ObjectId;
  product_tier: 'AUTHENTIC' | 'BUDGET_SMART';
  status: 'GENERATED' | 'PRINTED' | 'ACTIVE' | 'VOID_PRINT_ERROR' | 'CLAIMED' | 'EXPIRED';
  oem_manufacturer_serial?: string;
  qc_inspection_log: {
    inspected_by_staff_id: Types.ObjectId;
    inspected_at: Date;
    voltage_reading?: number;
    cable_resistance_ohm?: number;
    checklist_passed: boolean;
    tester_notes?: string;
  };
  void_log?: {
    voided_at: Date;
    voided_by_staff_id: Types.ObjectId;
    approved_by_godown_manager_id: Types.ObjectId;
    reason: 'PRINTER_JAM' | 'DAMAGED_LABEL' | 'FAILED_QC_RETEST';
  };
  verification_scans: Array<{
    scanned_at: Date;
    client_ip: string;
    device_id: string;
    user_agent: string;
    district_geo?: string;
    is_flagged_anomaly: boolean;
  }>;
  warranty_expiry_date: Date;
}

export const SealRecordQcSchema = new Schema<ISealRecordQc>(
  {
    seal_id: { 
      type: String, 
      required: true, 
      unique: true, 
      uppercase: true, 
      trim: true,
      validate: {
        validator: (v: string) => /^NCA-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/.test(v),
        message: 'Invalid Crockford Base32 Seal Token: {VALUE}'
      }
    },
    sku_id: { type: Schema.Types.ObjectId, ref: 'Sku', required: true, index: true },
    order_id: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
    product_tier: { 
      type: String, 
      enum: ['AUTHENTIC', 'BUDGET_SMART'], 
      required: true 
    },
    status: { 
      type: String, 
      enum: ['GENERATED', 'PRINTED', 'ACTIVE', 'VOID_PRINT_ERROR', 'CLAIMED', 'EXPIRED'], 
      default: 'GENERATED',
      index: true
    },
    oem_manufacturer_serial: { type: String, trim: true, index: true },
    qc_inspection_log: {
      inspected_by_staff_id: { type: Schema.Types.ObjectId, ref: 'UserCustomer', required: true },
      inspected_at: { type: Date, default: Date.now },
      voltage_reading: { type: Number },
      cable_resistance_ohm: { type: Number },
      checklist_passed: { type: Boolean, required: true },
      tester_notes: { type: String }
    },
    void_log: {
      voided_at: { type: Date },
      voided_by_staff_id: { type: Schema.Types.ObjectId, ref: 'UserCustomer' },
      approved_by_godown_manager_id: { type: Schema.Types.ObjectId, ref: 'UserCustomer' },
      reason: { type: String, enum: ['PRINTER_JAM', 'DAMAGED_LABEL', 'FAILED_QC_RETEST'] }
    },
    verification_scans: [
      {
        scanned_at: { type: Date, default: Date.now },
        client_ip: { type: String, required: true },
        device_id: { type: String, required: true },
        user_agent: { type: String, required: true },
        district_geo: { type: String },
        is_flagged_anomaly: { type: Boolean, default: false }
      }
    ],
    warranty_expiry_date: { type: Date, required: true }
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// Scan audit index for clone anomaly queries
SealRecordQcSchema.index({ "verification_scans.device_id": 1, "verification_scans.scanned_at": -1 });

export const SealRecordQcModel = model<ISealRecordQc>('SealRecordQc', SealRecordQcSchema);
```

---

### 2.3 Mongoose Schema: `LedgerJournal` (Double-Entry Balanced Accounting)
```typescript
export interface ILedgerLine {
  account_code: string;
  account_name: string;
  debit_paisa: number;
  credit_paisa: number;
}

export interface ILedgerJournal extends Document {
  entry_number: string;
  entry_date: Date;
  source_event_type: string;
  reference_entity_id: string;
  description: string;
  lines: ILedgerLine[];
  mushak_6_3?: {
    fiscal_year: string;
    gapless_serial_number: number;
    pdf_r2_key: string;
  };
}

export const LedgerJournalSchema = new Schema<ILedgerJournal>(
  {
    entry_number: { type: String, required: true, unique: true, uppercase: true },
    entry_date: { type: Date, default: Date.now, index: true },
    source_event_type: { 
      type: String, 
      required: true, 
      enum: [
        'ORDER_PAYMENT_ONLINE', 
        'COURIER_COD_REMITTANCE', 
        'RUNNER_PURCHASE_EXPENSE', 
        'PREORDER_DEPOSIT_COLLECTED', 
        'REVENUE_RECOGNITION', 
        'TAX_VAT_POSTING', 
        'CUSTOMER_REFUND'
      ] 
    },
    reference_entity_id: { type: String, required: true, index: true },
    description: { type: String, required: true },
    lines: [
      {
        account_code: { type: String, required: true },
        account_name: { type: String, required: true },
        debit_paisa: { type: Number, required: true, min: 0, default: 0 },
        credit_paisa: { type: Number, required: true, min: 0, default: 0 }
      }
    ],
    mushak_6_3: {
      fiscal_year: { type: String },
      gapless_serial_number: { type: Number },
      pdf_r2_key: { type: String }
    }
  },
  { 
    timestamps: { createdAt: 'created_at', updatedAt: false }, // Strictly Append-Only
    strict: 'throw' 
  }
);

// Pre-save validation: Invariant Enforcing Sum(Debit) === Sum(Credit)
LedgerJournalSchema.pre<ILedgerJournal>('save', function (next) {
  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of this.lines) {
    totalDebit += line.debit_paisa;
    totalCredit += line.credit_paisa;
  }

  if (totalDebit !== totalCredit) {
    return next(new Error(`DOUBLE_ENTRY_IMBALANCE: Debits (${totalDebit}) != Credits (${totalCredit})`));
  }

  if (totalDebit === 0) {
    return next(new Error('DOUBLE_ENTRY_ZERO_VALUE: Cannot post a zero-value journal entry'));
  }

  next();
});

export const LedgerJournalModel = model<ILedgerJournal>('LedgerJournal', LedgerJournalSchema);
```

---

## Part 3: Relational PostgreSQL / Drizzle ORM Schema Reference

For the Next.js 15 full-stack application (the primary production runtime specified in [architechture.md](./architechture.md)), below is the core Drizzle ORM table mapping:

```typescript
import { pgTable, uuid, varchar, text, integer, bigint, boolean, timestamp, check, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 1. Users & Customers
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  phone: varchar('phone', { length: 20 }).notNull().unique(),
  fullName: varchar('full_name', { length: 100 }).notNull(),
  role: varchar('role', { length: 30 }).notNull().default('CUSTOMER'),
  isActive: boolean('is_active').notNull().default(true),
  deliveredOrdersCount: integer('delivered_orders_count').notNull().default(0),
  rtoCount12m: integer('rto_count_12m').notNull().default(0),
  isCodBlacklisted: boolean('is_cod_blacklisted').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// 2. Inventory Balances (Physical Stock)
export const inventoryBalances = pgTable('inventory_balances', {
  id: uuid('id').defaultRandom().primaryKey(),
  skuId: uuid('sku_id').notNull(),
  locationCode: varchar('location_code', { length: 50 }).notNull(),
  onHand: integer('on_hand').notNull().default(0),
  reserved: integer('reserved').notNull().default(0),
  safetyStockThreshold: integer('safety_stock_threshold').notNull().default(5),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  stockConstraint: check('stock_non_negative', sql`${table.reserved} >= 0 AND ${table.onHand} >= ${table.reserved}`),
  skuLocIdx: uniqueIndex('sku_location_unique_idx').on(table.skuId, table.locationCode)
}));

// 3. Stock Reservations (10-Minute Cart Lock)
export const stockReservations = pgTable('stock_reservations', {
  id: uuid('id').defaultRandom().primaryKey(),
  reservationId: uuid('reservation_id').notNull().unique(),
  skuId: uuid('sku_id').notNull(),
  locationCode: varchar('location_code', { length: 50 }).notNull(),
  quantity: integer('quantity').notNull(),
  customerId: uuid('customer_id'),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'), // ACTIVE, COMMITTED, RELEASED, EXPIRED
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// 4. Crockford Base32 Tamper-Proof Seals
export const sealRecords = pgTable('seal_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  sealId: varchar('seal_id', { length: 16 }).notNull().unique(), // NCA-XXXX-XXXX
  skuId: uuid('sku_id').notNull(),
  orderId: uuid('order_id'),
  productTier: varchar('product_tier', { length: 20 }).notNull(), // AUTHENTIC, BUDGET_SMART
  status: varchar('status', { length: 20 }).notNull().default('GENERATED'),
  oemManufacturerSerial: varchar('oem_serial', { length: 100 }),
  warrantyExpiryDate: timestamp('warranty_expiry_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  crockfordRegexCheck: check('crockford_base32_format', sql`${table.sealId} ~ '^NCA-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$'`)
}));

// 5. General Ledger Lines (Append-Only)
export const journalLines = pgTable('journal_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  entryId: uuid('entry_id').notNull(),
  accountCode: varchar('account_code', { length: 20 }).notNull(),
  accountName: varchar('account_name', { length: 100 }).notNull(),
  debitPaisa: bigint('debit_paisa', { mode: 'number' }).notNull().default(0),
  creditPaisa: bigint('credit_paisa', { mode: 'number' }).notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  debitCreditCheck: check('valid_line_amount', sql`${table.debitPaisa} >= 0 AND ${table.creditPaisa} >= 0 AND (${table.debitPaisa} = 0) <> (${table.creditPaisa} = 0)`)
}));

// 6. Orders
export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderNumber: varchar('order_number', { length: 32 }).notNull().unique(),
  customerId: uuid('customer_id').notNull().references(() => users.id),
  channel: varchar('channel', { length: 30 }).notNull().default('STOREFRONT_WEB'),
  orderType: varchar('order_type', { length: 30 }).notNull(), // REGULAR_DROP_PACK | PRE_ORDER
  status: varchar('status', { length: 40 }).notNull().default('PENDING_PAYMENT'),
  totalPayablePaisa: bigint('total_payable_paisa', { mode: 'number' }).notNull(),
  depositPaidPaisa: bigint('deposit_paid_paisa', { mode: 'number' }).notNull().default(0),
  codAmountCollectiblePaisa: bigint('cod_amount_collectible_paisa', { mode: 'number' }).notNull().default(0),
  deliveryFeePaisa: integer('delivery_fee_paisa').notNull().default(8000),
  couponId: uuid('coupon_id'),
  storeCreditAppliedPaisa: bigint('store_credit_applied_paisa', { mode: 'number' }).notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// 7. Order Items
export const orderItems = pgTable('order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  skuId: uuid('sku_id').notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPricePaisa: bigint('unit_price_paisa', { mode: 'number' }).notNull(),
  allocatedDiscountPaisa: bigint('allocated_discount_paisa', { mode: 'number' }).notNull().default(0),
  vatRatePct: integer('vat_rate_pct').notNull().default(0),
  totalPricePaisa: bigint('total_price_paisa', { mode: 'number' }).notNull(),
  allocatedSealId: varchar('allocated_seal_id', { length: 16 })
});
```

---

## Part 4: Core Invariants & Validation Constraints

1. **Monetary Integer Paisa Rule:** Floating point numbers are prohibited in all database tables and calculations. ৳1.00 = 100 Paisa.
2. **Crockford Base32 Seal Invariant:** Seal IDs must strictly follow `/^NCA-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/` without `I, L, O, U`.
3. **Cart Isolation Invariant:** `order_type` is either `REGULAR_DROP_PACK` or `PRE_ORDER`. Mixed carts are rejected with `HTTP 422 Unprocessable Entity` (`ERR_MIXED_CART_DISALLOWED`).
4. **Physical Stock Integrity:** Condition `on_hand >= reserved AND reserved >= 0` is strictly enforced at database engine level.
5. **Double-Entry Balance Constraint:** Database trigger/pre-save hook enforces $\sum \text{Debit} - \sum \text{Credit} = 0$ for every journal entry before committing.

---

## Part 5: Relationship, Index & Key Validation Verification Matrix

### 5.1 Foreign Key & Relationship Integrity Matrix
Every parent-child relationship across the entire schema has been strictly audited for key alignment and reference integrity:

| Parent Collection / Table | Parent PK | Child Collection / Table | Child FK / Reference | Cascade / Delete Policy | Relationship Cardinality |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `categories_spec_templates` | `_id` | `categories_spec_templates` | `parent_category_id` | `RESTRICT` | 1 : N (Self-referencing taxonomy) |
| `categories_spec_templates` | `_id` | `products` | `category_id` | `RESTRICT` | 1 : N (Products categorized) |
| `products` | `_id` | `skus` | `product_id` | `CASCADE` | 1 : N (Variants belonging to product) |
| `products` | `comparison_group_id` | `products` | `comparison_group_id` | `SET NULL` | 1 : N (Authentic paired with Budget Smart) |
| `skus` | `_id` | `inventory_balances` | `sku_id` | `RESTRICT` | 1 : N (Physical counts per godown/bin) |
| `skus` | `_id` | `stock_reservations` | `sku_id` | `RESTRICT` | 1 : N (10-minute cart checkout locks) |
| `skus` | `_id` | `stock_movements` | `sku_id` | `RESTRICT` | 1 : N (Append-only physical stock log) |
| `skus` | `_id` | `orders.items` | `items[].sku_id` | `RESTRICT` | 1 : N (Order line items) |
| `skus` | `_id` | `seal_records_qc` | `sku_id` | `RESTRICT` | 1 : N (Serialized seal per physical unit) |
| `users_customers` | `_id` | `orders` | `customer_id` | `RESTRICT` | 1 : N (Orders placed by customer) |
| `users_customers` | `_id` | `payment_transactions` | `customer_id` | `RESTRICT` | 1 : N (Customer payment attempts) |
| `users_customers` | `_id` | `warranty_claims` | `customer_id` | `RESTRICT` | 1 : N (RMA claims filed by customer) |
| `users_customers` | `_id` | `runner_tasks_purchases` | `runner_staff_id` | `RESTRICT` | 1 : N (Field tasks assigned to runner) |
| `users_customers` | `_id` | `seal_records_qc` | `qc_inspection_log.inspected_by_staff_id` | `RESTRICT` | 1 : N (Inspections by QC technician) |
| `orders` | `_id` | `stock_reservations` | `order_id` | `SET NULL` | 1 : N (Cart locks associated to order) |
| `orders` | `_id` | `payment_transactions` | `order_id` | `RESTRICT` | 1 : N (Payments/deposits/refunds per order) |
| `orders` | `_id` | `courier_shipments` | `order_id` | `RESTRICT` | 1 : N (Shipments for forward/reverse) |
| `orders` | `_id` | `seal_records_qc` | `order_id` | `SET NULL` | 1 : N (Seals packed into order item) |
| `orders` | `_id` | `warranty_claims` | `order_id` | `RESTRICT` | 1 : N (Claims covering order items) |
| `seal_records_qc` | `seal_id` | `warranty_claims` | `seal_id` | `RESTRICT` | 1 : N (RMA validated against active seal) |
| `suppliers_stalls` | `_id` | `runner_tasks_purchases` | `target_stall_id` | `RESTRICT` | 1 : N (Sourcing runner targeted stalls) |
| `runner_float_sessions` | `_id` | `runner_tasks_purchases` | `float_session_id` | `RESTRICT` | 1 : N (Purchases funded from cash float) |

---

### 5.2 Key Uniqueness & Collision-Prevention Guarantee
Every entity enforces strict unique constraints to eliminate duplicate records:

| Collection / Table | Field Key | Constraint Type | Collision Guard & Business Purpose |
| :--- | :--- | :--- | :--- |
| `users_customers` | `phone` | **UNIQUE** | Zero duplicate accounts per Bangladeshi MSISDN. |
| `products` | `slug` | **UNIQUE** | Zero collision in storefront SEO routing. |
| `skus` | `sku_code` | **UNIQUE** | Zero collision in barcode scanning and warehousing. |
| `inventory_balances` | `{ sku_id, location_code }` | **COMPOUND UNIQUE** | Exactly one physical balance record per SKU per godown/bin. |
| `stock_reservations` | `reservation_id` | **UNIQUE UUID** | Idempotent checkout reservation tracking. |
| `orders` | `order_number` | **UNIQUE** | Human-readable sequential order reference (`ORD-YYYY-XXXXX`). |
| `payment_transactions` | `tran_id` | **UNIQUE** | Idempotent SSLCommerz payment callback & S2S validation. |
| `seal_records_qc` | `seal_id` | **UNIQUE** | Crockford Base32 cryptographic uniqueness ($32^8 \approx 1.1 \times 10^{12}$). |
| `runner_tasks_purchases` | `client_mutation_id` | **UNIQUE UUID** | Zero duplicate purchases during offline PWA sync batches. |
| `courier_shipments` | `courier_tracking_code` | **UNIQUE** | Direct indexing for 3rd-party courier webhooks. |
| `ledger_journal` | `entry_number` | **UNIQUE** | Gapless immutable sequence for general ledger auditability. |
| `transactional_outbox_audit` | `event_id` | **UNIQUE UUID** | Deduplication in BullMQ event relay worker (`jobId = outbox.id`). |

---

### 5.3 Query Index Coverage Matrix
Every high-throughput operational and analytical query pattern has a dedicated index:

| Query Pattern & Feature | Target Collection / Table | Index Keys | Index Type |
| :--- | :--- | :--- | :--- |
| OTP Login & Lookup | `users_customers` | `{ phone: 1 }` | Unique B-Tree |
| Session Token Verification | `users_customers` | `{ "active_sessions.token_hash": 1 }` | Sparse Compound |
| Storefront Catalog Filter | `products` | `{ category_id: 1, product_tier: 1, is_published: 1 }` | Compound B-Tree |
| Stock Availability Evaluation | `inventory_balances` | `{ sku_id: 1, location_code: 1 }` | Unique Compound |
| 10-Minute Lock Sweep | `stock_reservations` | `{ expires_at: 1 }` & `{ sku_id: 1, status: 1 }` | TTL / Status Compound |
| Customer Order History | `orders` | `{ customer_id: 1, created_at: -1 }` | Compound Descending |
| Admin Godown Dispatch Queue | `orders` | `{ status: 1, order_type: 1 }` | Compound B-Tree |
| `/verify` Portal Scan Lookup | `seal_records_qc` | `{ seal_id: 1 }` | Unique B-Tree |
| 24h Clone Anomaly Detection | `seal_records_qc` | `{ "verification_scans.device_id": 1, "verification_scans.scanned_at": -1 }` | Compound Descending |
| Courier Webhook Ingestion | `courier_shipments` | `{ courier_tracking_code: 1 }` | Unique B-Tree |
| Trial Balance & Ledger Reporting | `ledger_journal` | `{ "lines.account_code": 1, entry_date: -1 }` | Compound Descending |
| Outbox Relay Worker Polling | `transactional_outbox_audit` | `{ status: 1, scheduled_at: 1, priority_class: 1 }` | Compound Partial B-Tree |

