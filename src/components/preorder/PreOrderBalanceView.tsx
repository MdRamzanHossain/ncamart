"use client";

import React, { useState } from "react";
import Link from "next/link";
import { StorefrontShell } from "@/components/layout";
import {
  PreOrderBalanceData,
  PreOrderBalanceCard,
} from "./PreOrderBalanceCard";
import { ForfeitureCountdownBanner } from "./ForfeitureCountdownBanner";
import { BalanceSettlementModal } from "./BalanceSettlementModal";
import { MilestoneTracker } from "./MilestoneTracker";
import { PreOrderPolicyBanner } from "./PreOrderPolicyBanner";
import { HolographicSealPreview } from "@/components/trust";

export interface PreOrderBalanceViewProps {
  initialOrderData: PreOrderBalanceData;
}

export function PreOrderBalanceView({ initialOrderData }: PreOrderBalanceViewProps) {
  const [orderData, setOrderData] = useState<PreOrderBalanceData>(initialOrderData);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSettlementSuccess = () => {
    setOrderData((prev) => ({
      ...prev,
      orderStatus: "PACKED",
      balanceDuePaisa: 0,
    }));
    setIsModalOpen(false);
  };

  const isPacked = orderData.orderStatus === "PACKED";

  return (
    <StorefrontShell>
      <div className="balance-page-root">
        {/* Breadcrumb Navigation */}
        <div className="breadcrumb-wrapper">
          <div className="breadcrumb-inner">
            <Link href="/" className="crumb-link">Home</Link>
            <span className="crumb-sep">/</span>
            <Link href="/pre-orders" className="crumb-link">Pre-Orders</Link>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">Order #{orderData.orderNumber} Arrival Balance</span>
          </div>
        </div>

        <main className="balance-content-main">
          <div className="balance-container">
            {/* Top 7-Day Forfeiture Countdown Banner (Only if not yet settled) */}
            {!isPacked ? (
              <ForfeitureCountdownBanner forfeitureDaysWindow={7} />
            ) : (
              <div className="settled-success-banner">
                <div className="success-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="success-content">
                  <h4 className="success-title">Balance Fully Settled • Order Transitioned to PACKED</h4>
                  <p className="success-sub">
                    Payment verified via SSLCommerz. Unit is scheduled for central godown thermal labeling & courier dispatch.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-download-mushak"
                  onClick={() => alert(`Downloading Mushak 6.3 Tax Invoice for Order #${orderData.orderNumber}...`)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  <span>Download Mushak 6.3 Invoice</span>
                </button>
              </div>
            )}

            {/* Main Balance Due Card */}
            <PreOrderBalanceCard
              orderData={orderData}
              onOpenPayModal={() => setIsModalOpen(true)}
            />

            {/* 3D Holographic Seal Preview for this sealed parcel */}
            <div className="seal-section-box">
              <div className="seal-intro-text">
                <h3 className="section-title">Physical Destructive VOID Seal Verification</h3>
                <p className="section-desc">
                  This parcel has undergone QC bench testing and carries genuine Crockford Base32 Seal ID <strong>{orderData.sealId}</strong>.
                </p>
              </div>
              <HolographicSealPreview
                sealId={orderData.sealId}
                productTier="AUTHENTIC"
                brandName={orderData.brandName}
                title={orderData.itemTitle}
                qcDate={orderData.qcPassedAt}
              />
            </div>

            {/* Milestone Journey Tracker — Stage 4 Active */}
            <div className="milestone-block">
              <MilestoneTracker
                currentStageIndex={isPacked ? 4 : 3}
                arrivalWindow="Arrived & QC Passed"
                batchCode="AF-DH-2026-B08"
              />
            </div>

            {/* Policy & Terms Banner */}
            <PreOrderPolicyBanner />
          </div>
        </main>

        {/* Balance Settlement Payment Modal */}
        <BalanceSettlementModal
          orderData={orderData}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleSettlementSuccess}
        />
      </div>

      <style jsx>{`
        .balance-page-root {
          min-height: 100vh;
          background: var(--color-bg-canvas, #090d16);
          color: var(--color-text-primary, #f9fafb);
        }

        .breadcrumb-wrapper {
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(15, 23, 42, 0.5);
          padding: 0.75rem 1.5rem;
        }

        .breadcrumb-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8125rem;
        }

        .crumb-link {
          color: #9ca3af;
          text-decoration: none;
        }

        .crumb-link:hover {
          color: #60a5fa;
        }

        .crumb-sep {
          color: #4b5563;
        }

        .crumb-current {
          color: #e5e7eb;
          font-weight: 600;
        }

        .balance-content-main {
          padding: 2.5rem 1.5rem 4rem;
        }

        .balance-container {
          max-width: 1000px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .settled-success-banner {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 1.25rem;
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.35);
          border-radius: 1rem;
          padding: 1.25rem 1.5rem;
        }

        .success-icon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .success-content {
          flex: 1;
        }

        .success-title {
          font-size: 1.0625rem;
          font-weight: 800;
          color: #a7f3d0;
          margin: 0 0 0.2rem;
        }

        .success-sub {
          font-size: 0.8125rem;
          color: #9ca3af;
          margin: 0;
        }

        .btn-download-mushak {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #f3f4f6;
          font-size: 0.8125rem;
          font-weight: 700;
          padding: 0.625rem 1rem;
          border-radius: 0.625rem;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .btn-download-mushak:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .seal-section-box {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1.25rem;
          padding: 1.5rem;
        }

        .seal-intro-text {
          margin-bottom: 1.25rem;
        }

        .section-title {
          font-size: 1.125rem;
          font-weight: 800;
          color: #f3f4f6;
          margin: 0 0 0.25rem;
        }

        .section-desc {
          font-size: 0.8125rem;
          color: #9ca3af;
          margin: 0;
        }

        .section-desc strong {
          color: #60a5fa;
          font-family: var(--font-mono, monospace);
        }

        .milestone-block {
          width: 100%;
        }
      `}</style>
    </StorefrontShell>
  );
}
