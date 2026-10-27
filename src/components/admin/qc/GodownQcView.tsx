"use client";

import React, { useState } from "react";
import type { QcInspectionItem, VoidedSealLog, VoidReason } from "./types";
import { ThermalSealPrinter } from "./ThermalSealPrinter";
import { SealVoidModal } from "./SealVoidModal";
import { useToast } from "@/components/ui/toast";

const INITIAL_QC_QUEUE: QcInspectionItem[] = [
  {
    id: "QC-84920-01",
    orderNumber: "NCA-2026-84920",
    skuTitle: "Anker 735 GaNPrime 65W Fast Charger (3-Port)",
    skuCode: "ANK-735-65W",
    tier: "AUTHENTIC",
    quantity: 1,
    stallName: "Al-Madina Electronics Stall",
    marketName: "Taher Tower Electrical Market",
    runnerName: "Shakil Mollah",
    voucherMemoNumber: "MEMO-ALM-8492",
    status: "PENDING_INSPECTION",
    checklist: {
      housing: true,
      cableIntegrity: true,
      voltageWattage: true,
      packaging: true,
    },
  },
  {
    id: "QC-84921-02",
    orderNumber: "NCA-2026-84921",
    skuTitle: "MINIWARE TS101 65W Smart Soldering Iron (OLED)",
    skuCode: "MNW-TS101",
    tier: "AUTHENTIC",
    quantity: 2,
    stallName: "Bismillah Tools & Meters",
    marketName: "Taher Tower Electrical Market",
    runnerName: "Shakil Mollah",
    voucherMemoNumber: "MEMO-BIS-1102",
    status: "PENDING_INSPECTION",
    checklist: {
      housing: true,
      cableIntegrity: false,
      voltageWattage: false,
      packaging: true,
    },
  },
  {
    id: "QC-84918-01",
    orderNumber: "NCA-2026-84918",
    skuTitle: "Baseus Tungsten Gold 240W Type-C Braided Cable (2m)",
    skuCode: "BAS-240W-CBL",
    tier: "BUDGET_SMART",
    quantity: 3,
    stallName: "Haji Cables & Accessories",
    marketName: "Nawabpur Road Hardware Lane",
    runnerName: "Shakil Mollah",
    voucherMemoNumber: "MEMO-HAJ-9923",
    status: "APPROVED",
    checklist: {
      housing: true,
      cableIntegrity: true,
      voltageWattage: true,
      packaging: true,
    },
    sealId: "NCA-9X4K-2M7B",
    serialNumber: "SN-2026-84918-BAS",
    inspectedAt: "10:35 AM",
  },
];

// Helper to generate Crockford Base32 Seal ID
function generateCrockfordSealId(): string {
  const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // No I, L, O, U
  let result = "NCA-";
  for (let i = 0; i < 4; i++) {
    result += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  result += "-";
  for (let i = 0; i < 4; i++) {
    result += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return result;
}

export function GodownQcView() {
  const [queue, setQueue] = useState<QcInspectionItem[]>(INITIAL_QC_QUEUE);
  const [selectedItemId, setSelectedItemId] = useState<string>("QC-84920-01");
  const [searchCode, setSearchCode] = useState("");
  const [isPrinterOpen, setIsPrinterOpen] = useState(false);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [generatedSealId, setGeneratedSealId] = useState("");
  const [voidLogs, setVoidLogs] = useState<VoidedSealLog[]>([
    {
      id: "VOID-01",
      sealId: "NCA-4T7M-8K2L",
      reason: "PRINTER_JAM",
      voidedBy: "QC Tech Kabir",
      voidedAt: "09:40 AM",
      notes: "Paper jam on roll station 01",
    },
  ]);

  const { addToast } = useToast();

  const activeItem = queue.find((item) => item.id === selectedItemId) || queue[0];

  const handleChecklistToggle = (key: keyof QcInspectionItem["checklist"]) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === activeItem.id
          ? {
              ...item,
              checklist: {
                ...item.checklist,
                [key]: !item.checklist[key],
              },
            }
          : item
      )
    );
  };

  const isChecklistComplete =
    activeItem &&
    activeItem.checklist.housing &&
    activeItem.checklist.cableIntegrity &&
    activeItem.checklist.voltageWattage &&
    activeItem.checklist.packaging;

  const handleOpenPrintStation = () => {
    if (!isChecklistComplete) {
      addToast({
        title: "QC Checklist Incomplete",
        description: "All 4 inspection criteria must be verified before printing genuine holographic seals.",
        variant: "destructive",
      });
      return;
    }

    const newSeal = generateCrockfordSealId();
    setGeneratedSealId(newSeal);
    setIsPrinterOpen(true);
  };

  const handlePrintComplete = () => {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === activeItem.id
          ? {
              ...item,
              status: "APPROVED",
              sealId: generatedSealId,
              serialNumber: `SN-2026-${item.orderNumber.slice(-5)}-${item.skuCode}`,
              inspectedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            }
          : item
      )
    );
    setIsPrinterOpen(false);
  };

  const handleMarkDefective = () => {
    const reason = window.prompt("Enter defect inspection reason for wholesale stall return:");
    if (!reason) return;

    setQueue((prev) =>
      prev.map((item) =>
        item.id === activeItem.id
          ? {
              ...item,
              status: "DEFECTIVE_REJECTED",
              defectReason: reason,
            }
          : item
      )
    );

    addToast({
      title: "Item Marked as Defective",
      description: `Rejected. Runner task generated to return unit to ${activeItem.stallName}.`,
      variant: "destructive",
    });
  };

  const handleVoidConfirmed = (sealId: string, reason: VoidReason, notes?: string) => {
    const newLog: VoidedSealLog = {
      id: `VOID-${Date.now().toString().slice(-4)}`,
      sealId,
      reason,
      voidedBy: "QC Station Inspector",
      voidedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      notes,
    };
    setVoidLogs((prev) => [newLog, ...prev]);
  };

  const filteredQueue = queue.filter(
    (item) =>
      item.orderNumber.toLowerCase().includes(searchCode.toLowerCase()) ||
      item.skuCode.toLowerCase().includes(searchCode.toLowerCase()) ||
      item.voucherMemoNumber.toLowerCase().includes(searchCode.toLowerCase())
  );

  return (
    <div className="godown-qc-view" data-testid="godown-qc-view">
      {/* Top Header */}
      <div className="qc-header">
        <div>
          <div className="header-pill">Godown Central Quality Control</div>
          <h1 className="qc-title">QC Inspection &amp; Holographic Seal Station</h1>
          <p className="qc-sub">
            Verify wholesale drop-and-pack arrivals, perform electrical testing, and issue Crockford Base32 seals.
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn-open-void"
            onClick={() => setIsVoidModalOpen(true)}
            data-testid="btn-open-void-modal"
          >
            <span>⚠️ Void Damaged Seal</span>
          </button>
        </div>
      </div>

      {/* Search / Scan Voucher Input */}
      <div className="search-bar">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          className="search-input"
          placeholder="Scan Runner Voucher Memo, Order Number, or SKU..."
          value={searchCode}
          onChange={(e) => setSearchCode(e.target.value)}
          data-testid="qc-voucher-search-input"
        />
      </div>

      <div className="qc-grid">
        {/* Left Column: Intake Queue Table */}
        <div className="queue-panel">
          <div className="panel-title-row">
            <h2 className="panel-title">Intake Queue ({queue.length})</h2>
            <span className="queue-tag">Ready for Testing</span>
          </div>

          <div className="queue-list" data-testid="qc-intake-queue-list">
            {filteredQueue.map((item) => {
              const isSelected = item.id === activeItem?.id;
              return (
                <div
                  key={item.id}
                  className={`queue-item-card ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedItemId(item.id)}
                  data-testid={`qc-item-${item.id}`}
                >
                  <div className="item-top">
                    <span className="order-num font-mono">{item.orderNumber}</span>
                    <span className={`status-badge status-${item.status.toLowerCase()}`}>
                      {item.status === "APPROVED"
                        ? "PASSED"
                        : item.status === "DEFECTIVE_REJECTED"
                        ? "DEFECTIVE"
                        : "TESTING"}
                    </span>
                  </div>

                  <div className="item-sku-title">{item.skuTitle}</div>

                  <div className="item-stall-meta">
                    <span>📍 {item.stallName}</span>
                    <span>· Memo: {item.voucherMemoNumber}</span>
                  </div>

                  {item.sealId && (
                    <div className="item-assigned-seal font-mono">
                      <span>Seal: {item.sealId}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Inspection Station & 4-Point Checklist */}
        <div className="inspection-station-panel">
          {activeItem ? (
            <div className="active-inspection-card">
              <div className="station-header">
                <div>
                  <div className="station-tag">Active QC Test Bench</div>
                  <h2 className="active-title">{activeItem.skuTitle}</h2>
                  <div className="active-meta-row">
                    <span className="sku font-mono">{activeItem.skuCode}</span>
                    <span className="dot">·</span>
                    <span>Order: {activeItem.orderNumber}</span>
                    <span className="dot">·</span>
                    <span className="tier-tag">
                      {activeItem.tier === "AUTHENTIC" ? "100% Authentic" : "Budget Smart OEM"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4-Point Visual & Electrical Checklist */}
              <div className="checklist-card" data-testid="qc-checklist-card">
                <h3 className="checklist-heading">4-Point Physical &amp; Electrical Inspection Checklist</h3>

                <div className="checklist-items">
                  <label className="check-item">
                    <input
                      type="checkbox"
                      checked={activeItem.checklist.housing}
                      onChange={() => handleChecklistToggle("housing")}
                      data-testid="check-housing"
                    />
                    <div>
                      <div className="check-title">1. Physical Housing &amp; Enclosure Integrity</div>
                      <div className="check-sub">Zero scratches, intact OEM injection mold seams, pristine branding print</div>
                    </div>
                  </label>

                  <label className="check-item">
                    <input
                      type="checkbox"
                      checked={activeItem.checklist.cableIntegrity}
                      onChange={() => handleChecklistToggle("cableIntegrity")}
                      data-testid="check-cables"
                    />
                    <div>
                      <div className="check-title">2. Port Pins &amp; Connector Fit Tolerance</div>
                      <div className="check-sub">Snug connector fit, clean gold-plated contacts, no loose solder pins</div>
                    </div>
                  </label>

                  <label className="check-item">
                    <input
                      type="checkbox"
                      checked={activeItem.checklist.voltageWattage}
                      onChange={() => handleChecklistToggle("voltageWattage")}
                      data-testid="check-voltage"
                    />
                    <div>
                      <div className="check-title">3. Voltage / Wattage Dynamic Load Testing</div>
                      <div className="check-sub">Verified against electronic dummy load, thermal stability &amp; PD negotiation</div>
                    </div>
                  </label>

                  <label className="check-item">
                    <input
                      type="checkbox"
                      checked={activeItem.checklist.packaging}
                      onChange={() => handleChecklistToggle("packaging")}
                      data-testid="check-packaging"
                    />
                    <div>
                      <div className="check-title">4. Retail Packaging &amp; Barcode Intactness</div>
                      <div className="check-sub">Unopened retail box or anti-static OEM shield ready for holographic seal</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Station Decision Actions */}
              <div className="station-actions-bar">
                <button
                  type="button"
                  className="btn-reject"
                  onClick={handleMarkDefective}
                  data-testid="btn-mark-defective"
                >
                  <span>❌ Reject &amp; Return to Stall</span>
                </button>

                <button
                  type="button"
                  className="btn-pass-seal"
                  disabled={!isChecklistComplete}
                  onClick={handleOpenPrintStation}
                  data-testid="btn-pass-qc-print-seal"
                >
                  <span>✓ Pass QC &amp; Print Holographic Seal</span>
                </button>
              </div>

              {/* Void Audit Stream preview */}
              <div className="void-audit-preview">
                <div className="audit-header">
                  <span className="audit-title">Security Void Audit Logs (Latest)</span>
                  <span className="audit-count">{voidLogs.length} voided</span>
                </div>
                <div className="audit-list">
                  {voidLogs.map((log) => (
                    <div key={log.id} className="audit-row">
                      <span className="log-seal font-mono">{log.sealId}</span>
                      <span className="log-reason">{log.reason}</span>
                      <span className="log-tech">{log.voidedBy} ({log.voidedAt})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-selection">Select an item from the intake queue</div>
          )}
        </div>
      </div>

      {/* 50x25mm Thermal Label Print Modal */}
      {activeItem && (
        <ThermalSealPrinter
          isOpen={isPrinterOpen}
          item={activeItem}
          sealId={generatedSealId}
          serialNumber={`SN-2026-${activeItem.orderNumber.slice(-5)}-${activeItem.skuCode}`}
          onClose={() => setIsPrinterOpen(false)}
          onPrintComplete={handlePrintComplete}
        />
      )}

      {/* Seal Void Modal */}
      <SealVoidModal
        isOpen={isVoidModalOpen}
        onClose={() => setIsVoidModalOpen(false)}
        onVoidConfirmed={handleVoidConfirmed}
      />

      <style jsx>{`
        .godown-qc-view {
          flex: 1;
          padding: 24px 32px;
          background: #020617;
          min-height: 100vh;
          color: #f8fafc;
          font-family: var(--font-sans, system-ui, sans-serif);
        }

        .qc-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .header-pill {
          font-size: 10px;
          font-weight: 800;
          color: #f59e0b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .qc-title {
          font-size: 24px;
          font-weight: 900;
          margin: 0 0 4px 0;
          letter-spacing: -0.4px;
        }

        .qc-sub {
          font-size: 13px;
          color: #94a3b8;
          margin: 0;
        }

        .btn-open-void {
          padding: 8px 14px;
          border-radius: 8px;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        /* Search */
        .search-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 10px 14px;
          margin-bottom: 20px;
          max-width: 480px;
        }

        .search-icon {
          font-size: 14px;
        }

        .search-input {
          background: none;
          border: none;
          color: #f8fafc;
          font-size: 12px;
          outline: none;
          width: 100%;
        }

        /* Grid */
        .qc-grid {
          display: grid;
          grid-template-columns: 1.2fr 2fr;
          gap: 20px;
        }

        @media (max-width: 1024px) {
          .qc-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Queue */
        .queue-panel {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .panel-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .panel-title {
          font-size: 14px;
          font-weight: 800;
          margin: 0;
          color: #f8fafc;
        }

        .queue-tag {
          font-size: 10px;
          color: #38bdf8;
          font-weight: 700;
        }

        .queue-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .queue-item-card {
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          padding: 12px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 4px;
          transition: border-color 0.12s ease;
        }

        .queue-item-card.selected {
          border-color: #f59e0b;
          background: rgba(245, 158, 11, 0.05);
        }

        .item-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .order-num {
          font-size: 11px;
          font-weight: 800;
          color: #f8fafc;
        }

        .status-badge {
          font-size: 9px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .status-passed {
          background: rgba(16, 185, 129, 0.2);
          color: #10b981;
        }

        .status-testing {
          background: rgba(245, 158, 11, 0.2);
          color: #f59e0b;
        }

        .status-defective {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .item-sku-title {
          font-size: 12px;
          font-weight: 700;
          color: #e2e8f0;
        }

        .item-stall-meta {
          font-size: 10px;
          color: #94a3b8;
        }

        .item-assigned-seal {
          font-size: 10px;
          color: #10b981;
          font-weight: 800;
        }

        /* Inspection Station */
        .inspection-station-panel {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 20px;
        }

        .active-inspection-card {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .station-tag {
          font-size: 10px;
          font-weight: 800;
          color: #38bdf8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 2px;
        }

        .active-title {
          font-size: 18px;
          font-weight: 900;
          margin: 0 0 6px 0;
          color: #f8fafc;
        }

        .active-meta-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          color: #94a3b8;
        }

        .tier-tag {
          color: #f59e0b;
          font-weight: 800;
        }

        .font-mono {
          font-family: monospace;
        }

        /* Checklist */
        .checklist-card {
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 16px;
        }

        .checklist-heading {
          font-size: 12px;
          font-weight: 800;
          color: #cbd5e1;
          margin: 0 0 12px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .checklist-items {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .check-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          cursor: pointer;
        }

        .check-item input {
          margin-top: 3px;
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        .check-title {
          font-size: 12px;
          font-weight: 700;
          color: #f8fafc;
        }

        .check-sub {
          font-size: 11px;
          color: #94a3b8;
        }

        /* Actions Bar */
        .station-actions-bar {
          display: flex;
          gap: 12px;
        }

        .btn-reject {
          flex: 1;
          padding: 12px;
          border-radius: 8px;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .btn-pass-seal {
          flex: 2;
          padding: 12px;
          border-radius: 8px;
          background: #f59e0b;
          color: #0f172a;
          font-size: 12px;
          font-weight: 900;
          border: none;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .btn-pass-seal:hover:not(:disabled) {
          background: #fbbf24;
        }

        .btn-pass-seal:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* Void Preview */
        .void-audit-preview {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          padding: 12px;
        }

        .audit-header {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #94a3b8;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .audit-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .audit-row {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #cbd5e1;
        }

        .log-seal {
          color: #ef4444;
          font-weight: 800;
        }

        .log-reason {
          color: #f59e0b;
        }

        .log-tech {
          color: #64748b;
        }

        .empty-selection {
          padding: 48px;
          text-align: center;
          color: #64748b;
        }
      `}</style>
    </div>
  );
}
