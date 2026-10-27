"use client";

import React from "react";
import type { PosSaleReceipt } from "./types";
import { formatPaisa } from "@/lib/money";

interface ThermalReceiptPreviewProps {
  receipt: PosSaleReceipt;
  onClose?: () => void;
  autoPrint?: boolean;
}

export function ThermalReceiptPreview({
  receipt,
  onClose,
}: ThermalReceiptPreviewProps) {
  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const primarySeal = receipt.sealIds[0] || "NCA-9X4K-2M7B";

  return (
    <div className="thermal-preview-backdrop" data-testid="thermal-receipt-preview">
      <div className="thermal-preview-container">
        {/* Action bar for screen view */}
        <div className="preview-toolbar no-print">
          <div className="toolbar-info">
            <span className="thermal-paper-pill">80mm ESC/POS Thermal Paper</span>
            <span className="mushak-label">Official Mushak 6.3 Tax Invoice</span>
          </div>
          <div className="toolbar-btns">
            <button type="button" onClick={handlePrint} className="print-btn" data-testid="thermal-print-btn">
              🖨️ Print Receipt
            </button>
            {onClose && (
              <button type="button" onClick={onClose} className="close-btn" aria-label="Close receipt">
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 80mm ESC/POS Receipt Paper Canvas */}
        <div className="receipt-80mm-paper printable-receipt">
          {/* Header */}
          <header className="r-header">
            <h1 className="r-store-title">NAWABPUR COMPLEX ACCESSORIES</h1>
            <p className="r-store-sub">Direct Importer &amp; Engineering Wholesale Hub</p>
            <p className="r-address">Nawabpur Complex, Shop #14, Ground Floor, Nawabpur Road, Dhaka</p>
            <p className="r-contact">Hotline: +880 1711-223344 • www.ncamart.com</p>
            <div className="r-dash-line" />
            <div className="r-tax-badge">
              <strong>MUSHAK 6.3 VAT TAX INVOICE</strong>
            </div>
            <p className="r-bin">BIN: 002391029-0101 (Large Taxpayer Unit)</p>
            <p className="r-mushak-serial">Invoice No: {receipt.mushak63Serial}</p>
            <div className="r-dash-line" />
          </header>

          {/* Transaction Metadata */}
          <section className="r-meta-section">
            <div className="r-meta-row">
              <span>POS Trans: {receipt.invoiceNumber}</span>
              <span>{receipt.counterName}</span>
            </div>
            <div className="r-meta-row">
              <span>Date: {new Date().toISOString().split("T")[0]}</span>
              <span>Time: {receipt.timestamp}</span>
            </div>
            <div className="r-meta-row">
              <span>Cashier: {receipt.cashierName}</span>
              <span>Role: SHOWROOM_AGENT</span>
            </div>
            <div className="r-meta-row">
              <span>Customer: {receipt.customer.name}</span>
              <span>{receipt.customer.phone}</span>
            </div>
            <div className="r-dash-line" />
          </section>

          {/* Itemized Table */}
          <section className="r-items-section">
            <div className="r-items-table-header">
              <span className="col-desc">ITEM &amp; TIER</span>
              <span className="col-qty">QTY</span>
              <span className="col-rate">RATE</span>
              <span className="col-amt">TOTAL</span>
            </div>
            <div className="r-dash-line" />

            <div className="r-items-list">
              {receipt.items.map((item, idx) => (
                <div key={idx} className="r-item-block">
                  <div className="r-item-primary">
                    <span className="item-name">{item.product.title}</span>
                  </div>
                  <div className="r-item-meta-row">
                    <span className="col-desc sku-muted">
                      [{item.product.tier === "AUTHENTIC" ? "✨ AUTH" : "⚡ SMART"}] {item.product.skuCode}
                    </span>
                    <span className="col-qty">{item.quantity}</span>
                    <span className="col-rate">{formatPaisa(item.product.pricePaisa)}</span>
                    <span className="col-amt">{formatPaisa(item.product.pricePaisa * item.quantity)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="r-dash-line" />
          </section>

          {/* Financial Totals */}
          <section className="r-totals-section">
            <div className="r-tot-row">
              <span>Gross Subtotal:</span>
              <span>{formatPaisa(receipt.subtotalPaisa)}</span>
            </div>
            <div className="r-tot-row">
              <span>VAT 7.5% (Included):</span>
              <span>{formatPaisa(receipt.vatPaisa)}</span>
            </div>
            <div className="r-tot-row">
              <span>Delivery Fee (Counter Pickup):</span>
              <span>৳0.00</span>
            </div>
            <div className="r-tot-row r-net-total">
              <span>TOTAL PAYABLE (BDT):</span>
              <span>{formatPaisa(receipt.totalPaisa)}</span>
            </div>
            <div className="r-dash-line" />

            {/* Tender breakdown */}
            <div className="r-tot-row">
              <span>Payment Mode:</span>
              <span className="font-mono">
                {receipt.paymentMethod === "CASH"
                  ? "CASH TENDER"
                  : receipt.paymentMethod === "BKASH_QR"
                  ? "bKash POS QR"
                  : receipt.paymentMethod === "CARD_TERMINAL"
                  ? "CARD POS TERMINAL"
                  : "STORE CREDIT"}
              </span>
            </div>
            {receipt.paymentMethod === "CASH" && (
              <>
                <div className="r-tot-row">
                  <span>Cash Tendered:</span>
                  <span>{formatPaisa(receipt.tenderedPaisa)}</span>
                </div>
                <div className="r-tot-row font-bold">
                  <span>Change Given:</span>
                  <span>{formatPaisa(receipt.changeDuePaisa)}</span>
                </div>
              </>
            )}
            <div className="r-dash-line" />
          </section>

          {/* Tamper-Evident Holographic Seal Verification & QR */}
          <section className="r-seals-section">
            <div className="r-seal-box">
              <span className="seal-headline">★ TAMPER-EVIDENT HOLOGRAPHIC SEAL ★</span>
              <p className="seal-instruction">Scan or verify serial at ncamart.com/verify:</p>
              <div className="seal-ids-list">
                {receipt.sealIds.map((sealId, i) => (
                  <span key={i} className="seal-badge">
                    🔒 {sealId}
                  </span>
                ))}
              </div>
              <div className="r-simulated-qr">
                <div className="qr-box">
                  <span className="qr-ascii">
                    [ QR CODE: ncamart.com/verify/{primarySeal} ]
                  </span>
                </div>
              </div>
            </div>
            <div className="r-dash-line" />
          </section>

          {/* Footer & SLA terms */}
          <footer className="r-footer">
            <p className="warranty-guarantee">
              <strong>100% Genuine Guaranteed by Nawabpur Complex</strong>
            </p>
            <p>Claims reviewed in 1 hour • 72-Hour Doorstep Swap</p>
            <p>Exchange allowed within 7 days with intact seal and receipt.</p>
            <p className="power-by">NCAMart POS Engine v2.0 • Thermal 80mm ESC/POS</p>
            <div className="r-cut-guide">
              <span>- - - - - - - - - - CUT HERE - - - - - - - - - -</span>
            </div>
          </footer>
        </div>
      </div>

      <style jsx>{`
        .thermal-preview-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.82);
          backdrop-filter: blur(8px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          overflow-y: auto;
        }

        .thermal-preview-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          max-height: 95vh;
        }

        .preview-toolbar {
          width: 320px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #1e293b;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 10px;
          padding: 10px 14px;
        }

        .toolbar-info {
          display: flex;
          flex-direction: column;
        }

        .thermal-paper-pill {
          font-size: 11px;
          font-weight: 800;
          color: #f59e0b;
        }

        .mushak-label {
          font-size: 10px;
          color: #94a3b8;
        }

        .toolbar-btns {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .print-btn {
          padding: 6px 12px;
          border-radius: 6px;
          background: #10b981;
          color: #ffffff;
          font-size: 12px;
          font-weight: 800;
          border: none;
          cursor: pointer;
          transition: transform 0.15s ease;
        }

        .print-btn:hover {
          transform: scale(1.04);
        }

        .close-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
          border: none;
          cursor: pointer;
          font-size: 13px;
        }

        /* 80mm ESC/POS Thermal Receipt Paper Simulation */
        .receipt-80mm-paper {
          width: 320px;
          background: #ffffff;
          color: #000000;
          padding: 18px 14px;
          font-family: var(--font-mono, "Courier New", Courier, monospace);
          font-size: 11px;
          line-height: 1.35;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
          border-radius: 4px;
          overflow-y: auto;
          max-height: 80vh;
        }

        .r-header {
          text-align: center;
        }

        .r-store-title {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.5px;
          margin: 0 0 2px 0;
        }

        .r-store-sub {
          font-size: 9px;
          margin: 2px 0;
          font-weight: 700;
        }

        .r-address,
        .r-contact {
          font-size: 9px;
          margin: 1px 0;
        }

        .r-dash-line {
          border-bottom: 1px dashed #000;
          margin: 6px 0;
        }

        .r-tax-badge {
          font-size: 11px;
          font-weight: 900;
          margin: 4px 0 2px 0;
          letter-spacing: 0.5px;
        }

        .r-bin,
        .r-mushak-serial {
          font-size: 10px;
          margin: 1px 0;
        }

        /* Meta */
        .r-meta-section {
          font-size: 10px;
        }

        .r-meta-row {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
        }

        /* Items */
        .r-items-table-header {
          display: flex;
          font-size: 10px;
          font-weight: 800;
          justify-content: space-between;
        }

        .col-desc {
          width: 50%;
        }

        .col-qty {
          width: 12%;
          text-align: center;
        }

        .col-rate {
          width: 18%;
          text-align: right;
        }

        .col-amt {
          width: 20%;
          text-align: right;
        }

        .r-items-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .r-item-block {
          display: flex;
          flex-direction: column;
        }

        .r-item-primary {
          font-weight: 700;
          font-size: 10px;
        }

        .r-item-meta-row {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
        }

        .sku-muted {
          font-size: 9px;
          color: #333333;
        }

        /* Totals */
        .r-totals-section {
          font-size: 10px;
        }

        .r-tot-row {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
        }

        .r-net-total {
          font-size: 12px;
          font-weight: 900;
          padding: 2px 0;
        }

        .font-mono {
          font-weight: 800;
        }

        .font-bold {
          font-weight: 900;
        }

        /* Seals */
        .r-seals-section {
          text-align: center;
          font-size: 9px;
        }

        .seal-headline {
          font-weight: 800;
          font-size: 10px;
          display: block;
          margin-bottom: 2px;
        }

        .seal-instruction {
          margin: 2px 0;
        }

        .seal-ids-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin: 4px 0;
          font-weight: 700;
          font-size: 10px;
        }

        .r-simulated-qr {
          margin: 6px 0;
          display: flex;
          justify-content: center;
        }

        .qr-box {
          border: 1px solid #000;
          padding: 6px 8px;
          background: #fafafa;
          font-size: 8px;
          font-weight: 700;
        }

        /* Footer */
        .r-footer {
          text-align: center;
          font-size: 9px;
          color: #222;
        }

        .r-footer p {
          margin: 2px 0;
        }

        .warranty-guarantee {
          font-size: 10px;
        }

        .power-by {
          font-size: 8px;
          color: #666;
          margin-top: 4px;
        }

        .r-cut-guide {
          margin-top: 8px;
          font-size: 8px;
          color: #888;
        }

        /* Clean @media print rules for native browser thermal printing */
        @media print {
          body * {
            visibility: hidden;
          }

          .no-print {
            display: none !important;
          }

          .printable-receipt,
          .printable-receipt * {
            visibility: visible;
          }

          .printable-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm !important;
            padding: 2mm !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            max-height: none !important;
          }
        }
      `}</style>
    </div>
  );
}
