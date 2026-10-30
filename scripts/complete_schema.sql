-- ============================================================================
-- NCAMart Complete Schema Sync: Sourcing, Trust, RMA, Finance, Engagement, Notifications
-- ============================================================================

-- 1. Order Notes
CREATE TABLE IF NOT EXISTS order_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL,
  staff_name TEXT,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_notes_order_id ON order_notes(order_id);

-- 2. Preorder & Support Tasks
CREATE TABLE IF NOT EXISTS support_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  due_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  assigned_to UUID,
  resolution_notes TEXT,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_tasks_order_id ON support_tasks(order_id);
CREATE INDEX IF NOT EXISTS idx_support_tasks_customer_id ON support_tasks(customer_id);
CREATE INDEX IF NOT EXISTS idx_support_tasks_status_due ON support_tasks(status, due_at);

CREATE TABLE IF NOT EXISTS flash_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id UUID NOT NULL REFERENCES skus(id),
  qty INTEGER NOT NULL,
  price_paisa BIGINT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_flash_deals_sku_status ON flash_deals(sku_id, status);
CREATE INDEX IF NOT EXISTS idx_flash_deals_dates ON flash_deals(starts_at, ends_at);

-- 3. Sourcing Module (Suppliers, Runner Tasks, Float Sessions, Purchases)
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  proprietor_name TEXT NOT NULL,
  market TEXT NOT NULL,
  stall_no TEXT NOT NULL,
  floor TEXT NOT NULL,
  phone TEXT NOT NULL,
  bkash_merchant_number TEXT,
  accepted_payment_modes TEXT[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  suspended_reason TEXT,
  total_units_sourced INTEGER NOT NULL DEFAULT 0,
  qc_failed_units INTEGER NOT NULL DEFAULT 0,
  defect_rate_bp INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_market ON suppliers(market);
CREATE INDEX IF NOT EXISTS idx_suppliers_phone ON suppliers(phone);

CREATE TABLE IF NOT EXISTS supplier_stock (
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
  daily_order_cap INTEGER,
  last_quoted_cost_paisa BIGINT,
  priority INTEGER NOT NULL DEFAULT 1,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_by UUID,
  PRIMARY KEY (supplier_id, sku_id)
);
CREATE INDEX IF NOT EXISTS idx_supplier_stock_sku_id ON supplier_stock(sku_id);
CREATE INDEX IF NOT EXISTS idx_supplier_stock_status ON supplier_stock(status);
CREATE INDEX IF NOT EXISTS idx_supplier_stock_priority ON supplier_stock(priority);

CREATE TABLE IF NOT EXISTS supplier_qc_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  runner_task_id UUID,
  units_total INTEGER NOT NULL,
  units_failed INTEGER NOT NULL,
  outcome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supplier_qc_batches_supplier_id ON supplier_qc_batches(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_qc_batches_created_at ON supplier_qc_batches(created_at);

CREATE TABLE IF NOT EXISTS runner_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_number TEXT NOT NULL UNIQUE,
  task_type TEXT NOT NULL,
  order_id UUID,
  order_item_id UUID,
  sku_id UUID NOT NULL,
  qty INTEGER NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  backup_supplier_id UUID REFERENCES suppliers(id),
  max_unit_price_paisa BIGINT NOT NULL,
  runner_id UUID,
  status TEXT NOT NULL DEFAULT 'PENDING_ASSIGNMENT',
  quoted_unit_price_paisa BIGINT,
  override_reason TEXT,
  override_decided_by UUID,
  override_decision TEXT,
  due_at TIMESTAMPTZ NOT NULL,
  acknowledged_at TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_runner_tasks_runner_id ON runner_tasks(runner_id);
CREATE INDEX IF NOT EXISTS idx_runner_tasks_status ON runner_tasks(status);
CREATE INDEX IF NOT EXISTS idx_runner_tasks_order_id ON runner_tasks(order_id);
CREATE INDEX IF NOT EXISTS idx_runner_tasks_sku_id ON runner_tasks(sku_id);
CREATE INDEX IF NOT EXISTS idx_runner_tasks_due_at ON runner_tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_runner_tasks_created_at ON runner_tasks(created_at);

CREATE TABLE IF NOT EXISTS runner_task_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES runner_tasks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_runner_task_events_task_id ON runner_task_events(task_id);
CREATE INDEX IF NOT EXISTS idx_runner_task_events_created_at ON runner_task_events(created_at);

CREATE TABLE IF NOT EXISTS runner_float_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  runner_id UUID NOT NULL,
  issued_paisa BIGINT NOT NULL DEFAULT 0,
  purchases_cash_paisa BIGINT NOT NULL DEFAULT 0,
  supplier_refunds_paisa BIGINT NOT NULL DEFAULT 0,
  returned_paisa BIGINT,
  variance_paisa BIGINT,
  status TEXT NOT NULL DEFAULT 'OPEN',
  opened_by UUID NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  counted_by UUID,
  counted_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  variance_reason TEXT,
  sm_signoff_by UUID,
  fo_signoff_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_runner_float_sessions_runner ON runner_float_sessions(runner_id);
CREATE INDEX IF NOT EXISTS idx_runner_float_sessions_status ON runner_float_sessions(status);

CREATE TABLE IF NOT EXISTS runner_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_mutation_id TEXT UNIQUE NOT NULL,
  task_id UUID REFERENCES runner_tasks(id),
  float_session_id UUID REFERENCES runner_float_sessions(id),
  runner_id UUID NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  sku_id UUID NOT NULL,
  qty INTEGER NOT NULL,
  unit_cost_paisa BIGINT NOT NULL,
  amount_paisa BIGINT NOT NULL,
  payment_mode TEXT NOT NULL,
  receipt_media_id UUID,
  receipt_missing_flag BOOLEAN NOT NULL DEFAULT false,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID,
  sync_status TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_runner_purchases_runner_id ON runner_purchases(runner_id);
CREATE INDEX IF NOT EXISTS idx_runner_purchases_task_id ON runner_purchases(task_id);
CREATE INDEX IF NOT EXISTS idx_runner_purchases_float_session_id ON runner_purchases(float_session_id);
CREATE INDEX IF NOT EXISTS idx_runner_purchases_sync_status ON runner_purchases(sync_status);

-- 4. Trust & Warranty Verification Module (Seals, QC, Anti-clone)
CREATE TABLE IF NOT EXISTS seal_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seal_id TEXT NOT NULL UNIQUE,
  sku_id UUID NOT NULL REFERENCES skus(id),
  product_tier TEXT NOT NULL,
  order_item_unit_id UUID REFERENCES order_item_units(id),
  manufacturer_serial TEXT,
  status TEXT NOT NULL DEFAULT 'GENERATED',
  technician_id UUID NOT NULL,
  warranty_days INTEGER NOT NULL DEFAULT 0,
  warranty_start TIMESTAMPTZ,
  warranty_end TIMESTAMPTZ,
  void_reason TEXT,
  replaced_by_seal_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seal_records_manufacturer_serial ON seal_records(manufacturer_serial);
CREATE INDEX IF NOT EXISTS idx_seal_records_sku_id ON seal_records(sku_id);
CREATE INDEX IF NOT EXISTS idx_seal_records_status ON seal_records(status);
CREATE INDEX IF NOT EXISTS idx_seal_records_unit_id ON seal_records(order_item_unit_id);

CREATE TABLE IF NOT EXISTS seal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seal_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seal_events_seal_id ON seal_events(seal_id);
CREATE INDEX IF NOT EXISTS idx_seal_events_created_at ON seal_events(created_at);

CREATE TABLE IF NOT EXISTS qc_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seal_id TEXT,
  order_item_unit_id UUID,
  sku_id UUID NOT NULL REFERENCES skus(id),
  qc_type TEXT NOT NULL,
  test_checklist JSONB NOT NULL,
  result TEXT NOT NULL,
  technician_id UUID NOT NULL,
  photos JSONB NOT NULL DEFAULT '[]',
  sampled_for_audit BOOLEAN NOT NULL DEFAULT false,
  supervisor_id UUID,
  supervisor_result TEXT,
  supervisor_checked_at TIMESTAMPTZ,
  audit_due_at TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ,
  tester_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qc_records_sku_id ON qc_records(sku_id);
CREATE INDEX IF NOT EXISTS idx_qc_records_unit_id ON qc_records(order_item_unit_id);
CREATE INDEX IF NOT EXISTS idx_qc_records_seal_id ON qc_records(seal_id);
CREATE INDEX IF NOT EXISTS idx_qc_records_result ON qc_records(result);
CREATE INDEX IF NOT EXISTS idx_qc_records_sampled ON qc_records(sampled_for_audit);
CREATE INDEX IF NOT EXISTS idx_qc_records_audit_due ON qc_records(audit_due_at);

CREATE TABLE IF NOT EXISTS seal_void_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seal_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  requested_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  approved_by UUID,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seal_void_requests_seal_id ON seal_void_requests(seal_id);
CREATE INDEX IF NOT EXISTS idx_seal_void_requests_status ON seal_void_requests(status);

CREATE TABLE IF NOT EXISTS seal_verifications (
  id BIGSERIAL PRIMARY KEY,
  seal_id TEXT,
  query_raw TEXT NOT NULL,
  query_type TEXT NOT NULL,
  found BOOLEAN NOT NULL,
  device_id TEXT NOT NULL,
  ip TEXT NOT NULL,
  geo_district TEXT,
  user_agent TEXT NOT NULL,
  is_qr BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seal_verifications_seal_id ON seal_verifications(seal_id);
CREATE INDEX IF NOT EXISTS idx_seal_verifications_device_id ON seal_verifications(device_id);
CREATE INDEX IF NOT EXISTS idx_seal_verifications_ip ON seal_verifications(ip);
CREATE INDEX IF NOT EXISTS idx_seal_verifications_created_at ON seal_verifications(created_at);

CREATE TABLE IF NOT EXISTS seal_clone_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seal_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  distinct_devices INTEGER NOT NULL,
  distinct_districts JSONB NOT NULL,
  total_scans_24h INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  resolved_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seal_clone_alerts_seal_id ON seal_clone_alerts(seal_id);
CREATE INDEX IF NOT EXISTS idx_seal_clone_alerts_status ON seal_clone_alerts(status);
CREATE INDEX IF NOT EXISTS idx_seal_clone_alerts_created_at ON seal_clone_alerts(created_at);

-- 5. RMA & Reverse Logistics (Warranty Claims & Events)
CREATE TABLE IF NOT EXISTS warranty_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number VARCHAR(32) NOT NULL UNIQUE,
  seal_id VARCHAR(32) NOT NULL,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_unit_id UUID REFERENCES order_item_units(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  claim_type VARCHAR(32) NOT NULL,
  issue_description TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED',
  priority VARCHAR(32) NOT NULL DEFAULT 'NORMAL',
  decision TEXT,
  rejection_reason VARCHAR(32),
  resolution VARCHAR(32),
  reverse_shipment_id UUID REFERENCES courier_shipments(id) ON DELETE SET NULL,
  replacement_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  sla_due_at TIMESTAMPTZ,
  adjudicated_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  adjudicated_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  is_non_original_owner BOOLEAN NOT NULL DEFAULT FALSE,
  wants_assisted_transit BOOLEAN NOT NULL DEFAULT FALSE,
  distributor_name TEXT,
  distributor_sent_at TIMESTAMPTZ,
  distributor_returned_at TIMESTAMPTZ,
  distributor_outcome VARCHAR(32),
  liaison_task_id UUID REFERENCES runner_tasks(id) ON DELETE SET NULL,
  inspection_notes TEXT,
  verified_defect BOOLEAN,
  seal_intact BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_seal_id ON warranty_claims(seal_id);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_order_id ON warranty_claims(order_id);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_customer_id ON warranty_claims(customer_id);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_status ON warranty_claims(status);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_priority ON warranty_claims(priority);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_created_at ON warranty_claims(created_at);

CREATE TABLE IF NOT EXISTS claim_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES warranty_claims(id) ON DELETE CASCADE,
  from_status VARCHAR(32),
  to_status VARCHAR(32) NOT NULL,
  actor_type VARCHAR(32) NOT NULL,
  actor_id UUID,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_claim_events_claim_id ON claim_events(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_events_created_at ON claim_events(created_at);

-- 6. Refunds & Refund Events
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_number TEXT NOT NULL UNIQUE,
  order_id UUID NOT NULL REFERENCES orders(id),
  order_item_ids TEXT[] NOT NULL DEFAULT '{}',
  payment_tran_id TEXT,
  amount_paisa BIGINT NOT NULL,
  reason TEXT NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'REQUESTED',
  is_before_delivery BOOLEAN NOT NULL DEFAULT true,
  requested_by_type TEXT NOT NULL DEFAULT 'SYSTEM',
  requested_by_id TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  executed_by TEXT,
  executed_at TIMESTAMPTZ,
  external_ref TEXT,
  proof_media_id TEXT,
  gateway_refund_ref TEXT,
  payout_account TEXT,
  due_by TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_due_by ON refunds(due_by);

CREATE TABLE IF NOT EXISTS refund_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id UUID NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refund_events_refund_id ON refund_events(refund_id);
CREATE INDEX IF NOT EXISTS idx_refund_events_created_at ON refund_events(created_at);

-- 7. Finance & Settlements
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  invoice_no VARCHAR(30) NOT NULL UNIQUE,
  type TEXT NOT NULL,
  mushak_serial VARCHAR(60),
  fiscal_year VARCHAR(15) NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_bin TEXT,
  seller_bin TEXT NOT NULL,
  lines JSONB NOT NULL,
  subtotal_paisa BIGINT NOT NULL,
  vat_paisa BIGINT NOT NULL,
  total_paisa BIGINT NOT NULL,
  pdf_media_id UUID,
  issued_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_mushak_serial ON invoices(mushak_serial);
CREATE INDEX IF NOT EXISTS idx_invoices_fiscal_year ON invoices(fiscal_year);

CREATE TABLE IF NOT EXISTS courier_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier TEXT NOT NULL,
  payout_ref VARCHAR(100) NOT NULL,
  payout_date TIMESTAMPTZ NOT NULL,
  gross_collected_paisa BIGINT NOT NULL,
  total_charges_paisa BIGINT NOT NULL,
  net_paisa BIGINT NOT NULL,
  source TEXT NOT NULL,
  file_media_id UUID,
  imported_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'IMPORTED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_courier_settlements_courier ON courier_settlements(courier);
CREATE INDEX IF NOT EXISTS idx_courier_settlements_status ON courier_settlements(status);
CREATE INDEX IF NOT EXISTS idx_courier_settlements_payout_date ON courier_settlements(payout_date);

CREATE TABLE IF NOT EXISTS courier_settlement_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES courier_settlements(id) ON DELETE CASCADE,
  consignment_no TEXT NOT NULL,
  shipment_id UUID REFERENCES courier_shipments(id),
  collected_paisa BIGINT NOT NULL,
  delivery_charge_paisa BIGINT NOT NULL DEFAULT 0,
  cod_charge_paisa BIGINT NOT NULL DEFAULT 0,
  return_charge_paisa BIGINT NOT NULL DEFAULT 0,
  match_status TEXT NOT NULL DEFAULT 'PENDING',
  variance_paisa BIGINT NOT NULL DEFAULT 0,
  resolution_notes TEXT,
  resolved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_courier_settlement_lines_settlement_id ON courier_settlement_lines(settlement_id);
CREATE INDEX IF NOT EXISTS idx_courier_settlement_lines_consignment_no ON courier_settlement_lines(consignment_no);
CREATE INDEX IF NOT EXISTS idx_courier_settlement_lines_shipment_id ON courier_settlement_lines(shipment_id);
CREATE INDEX IF NOT EXISTS idx_courier_settlement_lines_match_status ON courier_settlement_lines(match_status);

CREATE TABLE IF NOT EXISTS settlement_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  ref_ids JSONB NOT NULL,
  amount_paisa BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  age_days INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  resolution TEXT,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_settlement_exceptions_kind ON settlement_exceptions(kind);
CREATE INDEX IF NOT EXISTS idx_settlement_exceptions_status ON settlement_exceptions(status);
CREATE INDEX IF NOT EXISTS idx_settlement_exceptions_age_days ON settlement_exceptions(age_days);
CREATE INDEX IF NOT EXISTS idx_settlement_exceptions_created_at ON settlement_exceptions(created_at);

CREATE TABLE IF NOT EXISTS gateway_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_ref VARCHAR(100) NOT NULL UNIQUE,
  payout_date TIMESTAMPTZ NOT NULL,
  gross_amount_paisa BIGINT NOT NULL,
  total_fee_paisa BIGINT NOT NULL,
  net_paisa BIGINT NOT NULL,
  source TEXT NOT NULL DEFAULT 'CSV',
  file_media_id UUID,
  imported_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'IMPORTED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gateway_settlements_status ON gateway_settlements(status);
CREATE INDEX IF NOT EXISTS idx_gateway_settlements_payout_date ON gateway_settlements(payout_date);

CREATE TABLE IF NOT EXISTS gateway_settlement_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES gateway_settlements(id) ON DELETE CASCADE,
  tran_id TEXT NOT NULL,
  amount_paisa BIGINT NOT NULL,
  fee_paisa BIGINT NOT NULL DEFAULT 0,
  net_paisa BIGINT NOT NULL,
  match_status TEXT NOT NULL DEFAULT 'PENDING',
  resolution_notes TEXT,
  resolved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gateway_settlement_lines_settlement_id ON gateway_settlement_lines(settlement_id);
CREATE INDEX IF NOT EXISTS idx_gateway_settlement_lines_tran_id ON gateway_settlement_lines(tran_id);
CREATE INDEX IF NOT EXISTS idx_gateway_settlement_lines_match_status ON gateway_settlement_lines(match_status);

CREATE TABLE IF NOT EXISTS report_export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'json',
  query_params JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  file_key TEXT,
  file_size_bytes BIGINT,
  download_url TEXT,
  error_message TEXT,
  created_by TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_report_export_jobs_status ON report_export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_report_export_jobs_created_at ON report_export_jobs(created_at);

-- 8. Notifications
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  channel TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'bn',
  class TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  whatsapp_template_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notification_templates_class ON notification_templates(class);
CREATE INDEX IF NOT EXISTS idx_notification_templates_channel ON notification_templates(channel);

CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type TEXT NOT NULL DEFAULT 'CUSTOMER',
  recipient_id TEXT,
  to_address TEXT NOT NULL,
  channel TEXT NOT NULL,
  template_code TEXT NOT NULL,
  class TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  provider TEXT NOT NULL,
  provider_message_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  error TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_to_address ON notification_logs(to_address);
CREATE INDEX IF NOT EXISTS idx_notification_logs_template_code ON notification_logs(template_code);
CREATE INDEX IF NOT EXISTS idx_notification_logs_provider_msg_id ON notification_logs(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_scheduled_at ON notification_logs(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at);

CREATE TABLE IF NOT EXISTS customer_notification_preferences (
  customer_id TEXT PRIMARY KEY,
  marketing_opt_in BOOLEAN NOT NULL DEFAULT false,
  whatsapp_opt_in BOOLEAN NOT NULL DEFAULT true,
  email_opt_in BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_notif_prefs_marketing ON customer_notification_preferences(marketing_opt_in);

-- 9. Analytics
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  aggregate_type TEXT,
  aggregate_id TEXT,
  user_id TEXT,
  anonymous_id TEXT,
  properties JSONB NOT NULL DEFAULT '{}',
  consent_status TEXT NOT NULL DEFAULT 'STRICTLY_NECESSARY',
  forwarded_to JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created ON analytics_events(event_name, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_aggregate ON analytics_events(aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);

-- 10. Engagement (Reviews, Wishlist, Stock Alerts, Carts)
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID UNIQUE NOT NULL REFERENCES order_items(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  product_id UUID NOT NULL REFERENCES products(id),
  sku_id UUID NOT NULL REFERENCES skus(id),
  tier TEXT NOT NULL,
  rating INTEGER NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  media_ids JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'PENDING',
  moderated_by TEXT,
  moderated_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_product_status ON reviews(product_id, status);
CREATE INDEX IF NOT EXISTS idx_reviews_customer ON reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  product_id UUID NOT NULL REFERENCES products(id),
  sku_id UUID REFERENCES skus(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wishlist_customer ON wishlist_items(customer_id);

CREATE TABLE IF NOT EXISTS stock_alert_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  sku_id UUID NOT NULL REFERENCES skus(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_stock_alert_sku_status ON stock_alert_subscriptions(sku_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_alert_customer ON stock_alert_subscriptions(customer_id);

CREATE TABLE IF NOT EXISTS carts (
  customer_id UUID PRIMARY KEY REFERENCES customers(id),
  items JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reminded_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_carts_updated_at ON carts(updated_at);

