"use client";

import React, { useState } from "react";
import Link from "next/link";
import { StorefrontShell } from "@/components/layout";
import { PreOrderHero } from "./PreOrderHero";
import { PreOrderCard } from "./PreOrderCard";
import { MilestoneTracker } from "./MilestoneTracker";
import { PreOrderPolicyBanner } from "./PreOrderPolicyBanner";
import { MOCK_PREORDERS } from "./mockData";

export function PreOrdersHubView() {
  const [activeTab, setActiveTab] = useState<"ALL" | "CLOSING" | "TESTING" | "SOLDERING">("ALL");

  const filteredItems = MOCK_PREORDERS.filter((item) => {
    if (activeTab === "CLOSING") return (item.reserved_quota / item.target_quota) >= 0.7;
    if (activeTab === "TESTING") return item.category_slug === "testing-equipment";
    if (activeTab === "SOLDERING") return item.category_slug === "soldering-rework";
    return true;
  });

  return (
    <StorefrontShell>
      <div className="preorder-page-root">
        {/* Breadcrumb Navigation */}
        <div className="breadcrumb-wrapper">
          <div className="breadcrumb-inner">
            <Link href="/" className="crumb-link">
              Home
            </Link>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">Pre-Orders & Air-Freight Batches</span>
          </div>
        </div>

        {/* Hero Banner Section */}
        <PreOrderHero />

        {/* Main Content Area */}
        <main className="preorder-content-main">
          <div className="content-container">
            {/* Filter Tabs & Batch Stats Bar */}
            <div className="filter-stats-bar">
              <div className="filter-tab-pills">
                <button
                  type="button"
                  className={`tab-pill ${activeTab === "ALL" ? "active" : ""}`}
                  onClick={() => setActiveTab("ALL")}
                >
                  All Active Batches ({MOCK_PREORDERS.length})
                </button>
                <button
                  type="button"
                  className={`tab-pill ${activeTab === "CLOSING" ? "active" : ""}`}
                  onClick={() => setActiveTab("CLOSING")}
                >
                  Closing Soon (&ge; 70% Quota)
                </button>
                <button
                  type="button"
                  className={`tab-pill ${activeTab === "TESTING" ? "active" : ""}`}
                  onClick={() => setActiveTab("TESTING")}
                >
                  Testing & Oscilloscopes
                </button>
                <button
                  type="button"
                  className={`tab-pill ${activeTab === "SOLDERING" ? "active" : ""}`}
                  onClick={() => setActiveTab("SOLDERING")}
                >
                  Soldering Stations
                </button>
              </div>

              <div className="stats-pill">
                <span className="live-dot" />
                <span>Next Air-Freight Flight: <strong>Friday, 23:45 BST</strong></span>
              </div>
            </div>

            {/* Showcase Grid */}
            <div className="showcase-grid-section">
              <div className="section-header-row">
                <div>
                  <h2 className="section-title">Verified Pre-Order Catalog</h2>
                  <p className="section-desc">
                    Units sourced directly from manufacturer authorized channels. Zero counterfeit branding guaranteed.
                  </p>
                </div>
                <div className="deposit-rule-tag">
                  Progressive 10%–20% Deposit • Remaining on Arrival
                </div>
              </div>

              <div className="cards-grid">
                {filteredItems.map((item) => (
                  <PreOrderCard key={item.id} item={item} />
                ))}
              </div>
            </div>

            {/* Interactive Milestone Progression Visualizer */}
            <div className="milestone-section-wrap">
              <MilestoneTracker
                currentStageIndex={1}
                arrivalWindow="Nov 12 – Nov 20, 2026"
                batchCode="AF-DH-2026-B08"
              />
            </div>

            {/* Policy & SLA Guarantee Banner */}
            <div className="policy-section-wrap">
              <PreOrderPolicyBanner />
            </div>

            {/* FAQ / How It Works Quick Accordion */}
            <section className="faq-section">
              <h2 className="faq-main-title">Frequently Asked Questions — Pre-Order Engine</h2>
              <div className="faq-grid">
                <div className="faq-item">
                  <h3 className="faq-q">How does the 10%–20% progressive deposit work?</h3>
                  <p className="faq-a">
                    You only pay a small fraction of the total landed cost today via SSLCommerz (bKash/Cards) to lock your unit in the upcoming air-cargo batch. Once the shipment arrives at our Nawabpur Godown and passes bench QC testing, you settle the remaining balance before dispatch or on showroom pickup.
                  </p>
                </div>

                <div className="faq-item">
                  <h3 className="faq-q">What if the import is delayed beyond the estimated arrival?</h3>
                  <p className="faq-a">
                    Every pre-order is protected by our 100% Refund SLA Guarantee. If your shipment is delayed more than 7 days beyond the confirmed ETA window, you are entitled to an instant 100% cash refund or a ৳1,000 store credit bonus if you choose to wait.
                  </p>
                </div>

                <div className="faq-item">
                  <h3 className="faq-q">Can I pay the remaining balance via Cash on Delivery?</h3>
                  <p className="faq-a">
                    Yes! For balances up to ৳30,000, eligible repeat customers and verified buyers can choose Cash on Delivery at doorstep. Balances can also be settled online or at our Nawabpur Showroom counter.
                  </p>
                </div>

                <div className="faq-item">
                  <h3 className="faq-q">Do imported pre-orders receive NCAMart Tamper Seals?</h3>
                  <p className="faq-a">
                    Absolutely. Before any unit leaves our Nawabpur Godown, our QC technicians run full diagnostic voltage/oscilloscope checks, apply our destructive holographic VOID seal, and register the Base32 serial on /verify.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      <style jsx>{`
        .preorder-page-root {
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
          transition: color 0.15s ease;
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

        .preorder-content-main {
          padding: 2.5rem 1.5rem 4rem;
        }

        .content-container {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 2.5rem;
        }

        .filter-stats-bar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0.75rem;
          padding: 0.875rem 1.25rem;
          backdrop-filter: blur(10px);
        }

        .filter-tab-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .tab-pill {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #9ca3af;
          font-size: 0.8125rem;
          font-weight: 600;
          padding: 0.4rem 0.875rem;
          border-radius: 9999px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .tab-pill:hover {
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.25);
        }

        .tab-pill.active {
          background: #2563eb;
          border-color: #3b82f6;
          color: #ffffff;
          box-shadow: 0 0 12px rgba(37, 99, 235, 0.4);
        }

        .stats-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.775rem;
          color: #d1d5db;
          background: rgba(0, 0, 0, 0.35);
          padding: 0.35rem 0.75rem;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .live-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
        }

        .section-header-row {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .section-title {
          font-size: 1.5rem;
          font-weight: 800;
          color: #f3f4f6;
          margin: 0 0 0.35rem;
          letter-spacing: -0.01em;
        }

        .section-desc {
          font-size: 0.875rem;
          color: #9ca3af;
          margin: 0;
        }

        .deposit-rule-tag {
          font-size: 0.75rem;
          font-weight: 600;
          color: #fcd34d;
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.3);
          padding: 0.35rem 0.75rem;
          border-radius: 9999px;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.5rem;
        }

        .faq-section {
          background: rgba(15, 23, 42, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1rem;
          padding: 2rem;
        }

        .faq-main-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #f3f4f6;
          margin: 0 0 1.5rem;
        }

        .faq-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
        }

        .faq-q {
          font-size: 0.9375rem;
          font-weight: 700;
          color: #60a5fa;
          margin: 0 0 0.5rem;
        }

        .faq-a {
          font-size: 0.8125rem;
          color: #9ca3af;
          line-height: 1.5;
          margin: 0;
        }

        @media (max-width: 640px) {
          .preorder-content-main {
            padding: 1.5rem 1rem 3rem;
          }
          .filter-stats-bar {
            flex-direction: column;
            align-items: flex-start;
          }
          .cards-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </StorefrontShell>
  );
}
