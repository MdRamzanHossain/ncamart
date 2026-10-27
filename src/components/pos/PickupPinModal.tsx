"use client";

import React, { useState, useRef, useEffect } from "react";
import type { PosSaleReceipt, PosCartItem } from "./types";
import { useToast } from "@/components/ui/toast";

interface PickupPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onHandoverComplete: (receipt: PosSaleReceipt) => void;
}

interface VerifiedPickupOrder {
  orderNumber: string;
  mushakSerial: string;
  customerName: string;
  customerPhone: string;
  pin: string;
  status: "READY_FOR_PICKUP" | "HANDED_OVER";
  sealId: string;
  items: PosCartItem[];
  totalPaisa: number;
  vatPaisa: number;
}

const MOCK_ORDER: VerifiedPickupOrder = {
  orderNumber: "NCA-2026-84920",
  mushakSerial: "M6.3-2026-849201",
  customerName: "Engr. Tanvir Ahmed",
  customerPhone: "+880 1711-223344",
  pin: "482910",
  status: "READY_FOR_PICKUP",
  sealId: "NCA-9X4K-2M7B",
  items: [
    {
      product: {
        id: "prod_01",
        skuId: "sku_anker_65w_blk",
        skuCode: "ANK-735-65W",
        barcode: "8901001",
        title: "Anker 735 GaNPrime 65W Fast Charger (3-Port)",
        category: "Fast Chargers",
        pricePaisa: 485000,
        showroomStock: 14,
        tier: "AUTHENTIC",
        image: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=400&q=80",
      },
      quantity: 1,
      assignedSealId: "NCA-9X4K-2M7B",
    },
    {
      product: {
        id: "prod_04",
        skuId: "sku_baseus_240w",
        skuCode: "BAS-240W-CBL",
        barcode: "8901004",
        title: "Baseus Tungsten Gold 240W Type-C Braided Cable (2m)",
        category: "Cables",
        pricePaisa: 125000,
        showroomStock: 28,
        tier: "AUTHENTIC",
        image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80",
      },
      quantity: 2,
      assignedSealId: "NCA-CBL-4421",
    },
  ],
  totalPaisa: 735000,
  vatPaisa: 51450,
};

export function PickupPinModal({
  isOpen,
  onClose,
  onHandoverComplete,
}: PickupPinModalProps) {
  const [pinDigits, setPinDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedOrder, setVerifiedOrder] = useState<VerifiedPickupOrder | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { addToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setPinDigits(["", "", "", "", "", ""]);
      setVerifiedOrder(null);
      setHasSignature(false);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDigitChange = (index: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...pinDigits];
    next[index] = digit;
    setPinDigits(next);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto verify when 6th digit entered
    const fullPin = next.join("");
    if (fullPin.length === 6 && !next.includes("")) {
      verifyPin(fullPin);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !pinDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyPin = (pin: string) => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      // Valid PIN simulation
      if (pin === "482910" || pin.startsWith("48") || pin === "123456") {
        setVerifiedOrder(MOCK_ORDER);
        addToast({
          title: "Pickup PIN Verified!",
          description: `Order ${MOCK_ORDER.orderNumber} for ${MOCK_ORDER.customerName} retrieved from locker.`,
          variant: "success",
        });
      } else {
        addToast({
          title: "Invalid Pickup PIN",
          description: "PIN does not match any orders awaiting handover. Please re-enter.",
          variant: "error",
        });
        setPinDigits(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    }, 400);
  };

  // Canvas drawing handlers for Customer Signature
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    setHasSignature(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = "#0ea5e9";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";

    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleConfirmHandover = () => {
    if (!verifiedOrder) return;
    if (!hasSignature) {
      addToast({
        title: "Signature Required",
        description: "Customer must sign on the signature pad to acknowledge physical receipt.",
        variant: "error",
      });
      return;
    }

    const receipt: PosSaleReceipt = {
      invoiceNumber: `POS-${verifiedOrder.orderNumber.slice(-5)}`,
      mushak63Serial: verifiedOrder.mushakSerial,
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }),
      cashierName: "Rashid Alam",
      counterName: "Showroom Counter #1",
      customer: {
        phone: verifiedOrder.customerPhone,
        name: verifiedOrder.customerName,
        isGuest: false,
      },
      items: verifiedOrder.items,
      subtotalPaisa: verifiedOrder.totalPaisa,
      vatPaisa: verifiedOrder.vatPaisa,
      totalPaisa: verifiedOrder.totalPaisa,
      tenderedPaisa: verifiedOrder.totalPaisa,
      changeDuePaisa: 0,
      paymentMethod: "STORE_CREDIT",
      paymentRef: `PIN-${verifiedOrder.pin}`,
      sealIds: verifiedOrder.items.map((i) => i.assignedSealId || verifiedOrder.sealId),
    };

    addToast({
      title: "Handover Complete!",
      description: `Order ${verifiedOrder.orderNumber} status transitioned to DELIVERED.`,
      variant: "success",
    });

    onHandoverComplete(receipt);
  };

  return (
    <div className="pickup-modal-backdrop" data-testid="pickup-pin-modal">
      <div className="pickup-modal-card">
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="badge-row">
              <span className="counter-pill">Nawabpur Showroom Pickup</span>
              <span className="spec-tag">PRD §3.10 PIN Security Guard</span>
            </div>
            <h2 className="modal-title">Verify 6-Digit Customer Pickup PIN</h2>
            <p className="modal-sub">
              Customer presents the 6-digit PIN from their mobile screen / SMS to claim prepaid equipment.
            </p>
          </div>
          <button type="button" onClick={onClose} className="close-btn" aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* PIN Entry Box */}
        {!verifiedOrder && (
          <div className="pin-entry-section">
            <div className="pin-quick-chips">
              <span className="sim-chip-label">Quick PIN Sim:</span>
              <button
                type="button"
                className="chip-btn"
                onClick={() => {
                  const demo = ["4", "8", "2", "9", "1", "0"];
                  setPinDigits(demo);
                  verifyPin("482910");
                }}
              >
                Auto-Fill 482910 (Engr. Tanvir)
              </button>
            </div>

            <div className="pin-inputs-row">
              {pinDigits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputRefs.current[i] = el;
                  }}
                  type="text"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className={`pin-digit-box ${d ? "filled" : ""}`}
                  data-testid={`pin-digit-${i}`}
                />
              ))}
            </div>

            {isVerifying && <p className="verifying-text">Checking PIN with Godown locker database...</p>}
          </div>
        )}

        {/* Verified Parcel Details & Signature Section */}
        {verifiedOrder && (
          <div className="verified-details-section">
            <div className="order-summary-card">
              <div className="order-head">
                <span className="order-num">{verifiedOrder.orderNumber}</span>
                <span className="order-status-pill">READY FOR HANDOVER</span>
              </div>

              <div className="cust-row">
                <span className="cust-name">{verifiedOrder.customerName}</span>
                <span className="cust-phone">{verifiedOrder.customerPhone}</span>
              </div>

              {/* Holographic Seal Badge */}
              <div className="seal-badge-row">
                <span className="seal-verified-pill">
                  🔒 Tamper-Proof Seal: <strong>{verifiedOrder.sealId}</strong>
                </span>
                <span className="godown-sign">✓ Nawabpur QC Passed</span>
              </div>

              {/* Items List */}
              <div className="parcel-items-list">
                {verifiedOrder.items.map((item, idx) => (
                  <div key={idx} className="parcel-item">
                    <span>
                      {item.quantity}x {item.product.title}
                    </span>
                    <span className="item-sku">{item.product.skuCode}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Digital Signature Pad */}
            <div className="signature-section">
              <div className="sig-header">
                <label className="sig-label">Customer Physical Signature (Draw Below)</label>
                {hasSignature && (
                  <button type="button" onClick={clearSignature} className="clear-sig-btn">
                    Clear Signature
                  </button>
                )}
              </div>

              <canvas
                ref={canvasRef}
                width={380}
                height={120}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="signature-canvas"
                data-testid="signature-canvas"
              />
              <span className="sig-hint">Customer signs on touchscreen or mouse pad to confirm inspection</span>
            </div>

            {/* Handover CTA */}
            <div className="handover-actions">
              <button
                type="button"
                onClick={handleConfirmHandover}
                className="confirm-handover-btn"
                data-testid="confirm-handover-btn"
              >
                <span>⚡ Complete Handover &amp; Print Mushak 6.3</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .pickup-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .pickup-modal-card {
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 16px;
          max-width: 480px;
          width: 100%;
          padding: 24px;
          color: #f8fafc;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .badge-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }

        .counter-pill {
          font-size: 11px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 6px;
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .spec-tag {
          font-size: 10px;
          color: #94a3b8;
          font-family: monospace;
        }

        .modal-title {
          font-size: 20px;
          font-weight: 800;
          margin: 0 0 4px 0;
        }

        .modal-sub {
          font-size: 12px;
          color: #94a3b8;
          margin: 0;
          line-height: 1.4;
        }

        .close-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          border: none;
          cursor: pointer;
          font-size: 14px;
        }

        /* PIN Inputs */
        .pin-entry-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 20px 0;
        }

        .pin-quick-chips {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sim-chip-label {
          font-size: 11px;
          color: #94a3b8;
        }

        .chip-btn {
          padding: 4px 10px;
          border-radius: 6px;
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.3);
          color: #fbbf24;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .pin-inputs-row {
          display: flex;
          gap: 10px;
        }

        .pin-digit-box {
          width: 52px;
          height: 60px;
          background: #000;
          border: 2px solid rgba(255, 255, 255, 0.15);
          border-radius: 10px;
          color: #fff;
          font-size: 28px;
          font-weight: 900;
          text-align: center;
          transition: all 0.2s ease;
        }

        .pin-digit-box:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.4);
          outline: none;
        }

        .pin-digit-box.filled {
          border-color: #10b981;
          color: #10b981;
        }

        .verifying-text {
          font-size: 12px;
          color: #38bdf8;
          font-style: italic;
        }

        /* Verified Order Section */
        .verified-details-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .order-summary-card {
          background: rgba(30, 41, 59, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .order-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .order-num {
          font-size: 14px;
          font-weight: 800;
          color: #f59e0b;
        }

        .order-status-pill {
          font-size: 10px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .cust-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
        }

        .cust-name {
          font-weight: 700;
          color: #f8fafc;
        }

        .cust-phone {
          color: #94a3b8;
          font-family: monospace;
        }

        .seal-badge-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 8px;
          border-radius: 6px;
          background: rgba(0, 0, 0, 0.3);
        }

        .seal-verified-pill {
          font-size: 11px;
          color: #38bdf8;
          font-family: monospace;
        }

        .godown-sign {
          font-size: 10px;
          color: #10b981;
          font-weight: 700;
        }

        .parcel-items-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          padding-top: 6px;
        }

        .parcel-item {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #cbd5e1;
        }

        .item-sku {
          color: #64748b;
          font-family: monospace;
        }

        /* Signature Canvas */
        .signature-section {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .sig-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .sig-label {
          font-size: 11px;
          font-weight: 700;
          color: #cbd5e1;
        }

        .clear-sig-btn {
          font-size: 10px;
          color: #ef4444;
          background: none;
          border: none;
          cursor: pointer;
        }

        .signature-canvas {
          background: #000;
          border: 1px dashed rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          cursor: crosshair;
          touch-action: none;
        }

        .sig-hint {
          font-size: 10px;
          color: #64748b;
        }

        .confirm-handover-btn {
          width: 100%;
          padding: 14px;
          border-radius: 10px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: #fff;
          font-size: 14px;
          font-weight: 800;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 16px rgba(16, 185, 129, 0.35);
          transition: all 0.2s ease;
        }

        .confirm-handover-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 22px rgba(16, 185, 129, 0.5);
        }
      `}</style>
    </div>
  );
}
