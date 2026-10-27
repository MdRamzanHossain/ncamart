"use client";

import React from "react";
import Link from "next/link";
import { PreOrderItem, calculateDepositBreakdown } from "./types";
import { PreOrderQuotaBar } from "./PreOrderQuotaBar";

export interface PreOrderCardProps {
  item: PreOrderItem;
}

export function PreOrderCard({ item }: PreOrderCardProps) {
  const breakdown = calculateDepositBreakdown(item.total_price_paisa, item.deposit_percent);

  return (
    <div className="preorder-card">
      {/* Header Badges */}
      <div className="card-top-row">
        <span className="badge-deposit">
          {item.deposit_percent}% Advance Deposit
        </span>
        <span className="badge-arrival">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {item.estimated_arrival_window}
        </span>
      </div>

      {/* Product Image & Hub Pin */}
      <div className="card-media-wrap">
        <Link href={`/pre-orders/${item.slug}`} className="media-link">
          <div className="image-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            <span className="hub-tag">{item.origin_hub}</span>
          </div>
        </Link>
      </div>

      {/* Info Container */}
      <div className="card-body">
        <div className="category-brand">
          <span className="brand-name">{item.brand_name}</span>
          <span className="dot-sep">•</span>
          <span className="cat-name">{item.category_name}</span>
        </div>

        <Link href={`/pre-orders/${item.slug}`}>
          <h3 className="item-title" title={item.title_en}>
            {item.title_en}
          </h3>
        </Link>

        {/* Milestone Quota Progress Bar */}
        <div className="quota-container">
          <PreOrderQuotaBar
            reserved={item.reserved_quota}
            target={item.target_quota}
            batchCode={item.batch_code}
          />
        </div>

        {/* Pricing & Deposit Calculator Block */}
        <div className="pricing-box">
          <div className="price-row-main">
            <div>
              <span className="price-label">Total Landed Price:</span>
              <div className="price-total">{breakdown.formattedTotal}</div>
            </div>
            <div className="deposit-box">
              <span className="deposit-label">Pay Today to Reserve:</span>
              <div className="deposit-amount">{breakdown.formattedDeposit}</div>
            </div>
          </div>

          <div className="arrival-balance-note">
            Remaining balance <strong>{breakdown.formattedRemaining}</strong> payable upon godown arrival
          </div>
        </div>

        {/* Action Button */}
        <div className="card-action">
          <Link href={`/pre-orders/${item.slug}`} className="btn-reserve">
            <span>Reserve Unit with {breakdown.formattedDeposit}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      <style jsx>{`
        .preorder-card {
          background: rgba(17, 24, 39, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1rem;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
          position: relative;
        }

        .preorder-card:hover {
          transform: translateY(-4px);
          border-color: rgba(96, 165, 250, 0.4);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45), 0 0 20px rgba(59, 130, 246, 0.1);
        }

        .card-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.875rem 1rem 0;
          gap: 0.5rem;
        }

        .badge-deposit {
          font-size: 0.725rem;
          font-weight: 700;
          color: #fcd34d;
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.35);
          padding: 0.25rem 0.6rem;
          border-radius: 9999px;
          letter-spacing: 0.02em;
        }

        .badge-arrival {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.725rem;
          color: #93c5fd;
          background: rgba(59, 130, 246, 0.12);
          border: 1px solid rgba(59, 130, 246, 0.25);
          padding: 0.25rem 0.6rem;
          border-radius: 9999px;
        }

        .card-media-wrap {
          padding: 1rem;
          background: linear-gradient(180deg, rgba(30, 41, 59, 0.4) 0%, transparent 100%);
        }

        .media-link {
          display: block;
          text-decoration: none;
        }

        .image-placeholder {
          height: 180px;
          border-radius: 0.75rem;
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          position: relative;
        }

        .hub-tag {
          font-size: 0.7rem;
          color: #9ca3af;
          background: rgba(0, 0, 0, 0.5);
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .card-body {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .category-brand {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.75rem;
          color: var(--color-text-muted, #9ca3af);
          margin-bottom: 0.5rem;
        }

        .brand-name {
          font-weight: 600;
          color: #60a5fa;
        }

        .dot-sep {
          opacity: 0.5;
        }

        .item-title {
          font-size: 1rem;
          font-weight: 700;
          line-height: 1.4;
          color: var(--color-text-primary, #f9fafb);
          margin: 0 0 1rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          transition: color 0.2s ease;
        }

        .item-title:hover {
          color: #93c5fd;
        }

        .quota-container {
          margin-bottom: 1.25rem;
          padding: 0.75rem;
          background: rgba(0, 0, 0, 0.25);
          border-radius: 0.625rem;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .pricing-box {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0.75rem;
          padding: 0.875rem;
          margin-bottom: 1.25rem;
        }

        .price-row-main {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .price-label {
          font-size: 0.7rem;
          color: #9ca3af;
          display: block;
        }

        .price-total {
          font-size: 1.125rem;
          font-weight: 700;
          color: #f3f4f6;
        }

        .deposit-box {
          text-align: right;
        }

        .deposit-label {
          font-size: 0.7rem;
          color: #fcd34d;
          display: block;
          font-weight: 600;
        }

        .deposit-amount {
          font-size: 1.25rem;
          font-weight: 800;
          color: #fbbf24;
        }

        .arrival-balance-note {
          font-size: 0.725rem;
          color: #9ca3af;
          border-top: 1px dashed rgba(255, 255, 255, 0.1);
          padding-top: 0.5rem;
        }

        .arrival-balance-note strong {
          color: #e5e7eb;
        }

        .card-action {
          margin-top: auto;
        }

        .btn-reserve {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 100%;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          padding: 0.75rem 1rem;
          border-radius: 0.625rem;
          font-size: 0.875rem;
          font-weight: 700;
          text-decoration: none;
          transition: background 0.2s ease, transform 0.15s ease;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }

        .btn-reserve:hover {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
}
