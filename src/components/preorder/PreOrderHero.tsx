"use client";

import React from "react";

export function PreOrderHero() {
  return (
    <section className="preorder-hero-container">
      {/* Background radial glow */}
      <div className="hero-glow-layer" />

      <div className="preorder-hero-inner">
        {/* Top Badges */}
        <div className="hero-badge-group">
          <span className="hero-pill-primary">
            <span className="status-dot-pulse" />
            Air-Freight Import Batches
          </span>
          <span className="hero-pill-secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            100% Authentic & BTRC Cleared
          </span>
          <span className="hero-pill-tertiary">
            10%–20% Progressive Deposit
          </span>
        </div>

        {/* Main Heading */}
        <h1 className="hero-title">
          Direct Import of Specialized <br />
          <span className="gradient-text">Engineering Gear & High-End Tech Tools</span>
        </h1>

        {/* Subtitle */}
        <p className="hero-subtitle">
          Secure rare micro-soldering stations, digital oscilloscopes, and industrial thermal cameras directly
          from verified Asian & Global tech hubs. Lock your quota with a small 10%–20% advance deposit;
          pay the remaining balance only upon safe arrival and QC inspection at our Nawabpur Godown.
        </p>

        {/* 4 Trust Value Pillars */}
        <div className="trust-grid">
          <div className="trust-item">
            <div className="trust-icon-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-400)" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div>
              <h2 className="trust-title">Progressive Deposit</h2>
              <p className="trust-desc">Only 10% to 20% advance required to book. No hidden customs surcharge.</p>
            </div>
          </div>

          <div className="trust-item">
            <div className="trust-icon-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-success-400)" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <div>
              <h2 className="trust-title">100% Refund SLA Guarantee</h2>
              <p className="trust-desc">Full 100% cash refund if arrival is delayed beyond promised ETA + 7 days.</p>
            </div>
          </div>

          <div className="trust-item">
            <div className="trust-icon-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning-400)" strokeWidth="2">
                <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z" />
              </svg>
            </div>
            <div>
              <h2 className="trust-title">Air-Freight Batching</h2>
              <p className="trust-desc">Consolidated weekly air cargo flights straight to Dhaka Hazrat Shahjalal Airport.</p>
            </div>
          </div>

          <div className="trust-item">
            <div className="trust-icon-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-info-400)" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <div>
              <h2 className="trust-title">Godown QC & Hologram</h2>
              <p className="trust-desc">Every imported unit bench-tested with destructive tamper seal applied before dispatch.</p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .preorder-hero-container {
          position: relative;
          background: linear-gradient(180deg, rgba(17, 24, 39, 0.95) 0%, rgba(10, 14, 23, 0.98) 100%);
          border-bottom: 1px solid var(--color-border-subtle, rgba(255, 255, 255, 0.08));
          padding: 3rem 1.5rem 2.5rem;
          overflow: hidden;
        }

        .hero-glow-layer {
          position: absolute;
          top: -150px;
          left: 50%;
          transform: translateX(-50%);
          width: 700px;
          height: 350px;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.18) 0%, rgba(139, 92, 246, 0.08) 50%, transparent 80%);
          filter: blur(60px);
          pointer-events: none;
        }

        .preorder-hero-inner {
          position: relative;
          max-width: 1200px;
          margin: 0 auto;
          text-align: center;
          z-index: 1;
        }

        .hero-badge-group {
          display: inline-flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 0.625rem;
          margin-bottom: 1.25rem;
        }

        .hero-pill-primary {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: rgba(59, 130, 246, 0.12);
          border: 1px solid rgba(59, 130, 246, 0.35);
          color: #93c5fd;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 0.3rem 0.75rem;
          border-radius: 9999px;
        }

        .status-dot-pulse {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #60a5fa;
          box-shadow: 0 0 8px #60a5fa;
          animation: pulse 1.8s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }

        .hero-pill-secondary {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #6ee7b7;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.3rem 0.75rem;
          border-radius: 9999px;
        }

        .hero-pill-tertiary {
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.3);
          color: #fcd34d;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.3rem 0.75rem;
          border-radius: 9999px;
        }

        .hero-title {
          font-size: clamp(1.75rem, 4vw, 2.75rem);
          font-weight: 800;
          line-height: 1.2;
          color: var(--color-text-primary, #f9fafb);
          margin-bottom: 1rem;
          letter-spacing: -0.02em;
        }

        .gradient-text {
          background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #f472b6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-subtitle {
          max-width: 780px;
          margin: 0 auto 2.5rem;
          font-size: 1rem;
          line-height: 1.6;
          color: var(--color-text-muted, #9ca3af);
        }

        .trust-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1.25rem;
          text-align: left;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1rem;
          padding: 1.5rem;
          backdrop-filter: blur(12px);
        }

        .trust-item {
          display: flex;
          align-items: flex-start;
          gap: 0.875rem;
        }

        .trust-icon-wrap {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 0.625rem;
          background: rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .trust-title {
          font-size: 0.875rem;
          font-weight: 700;
          color: #f3f4f6;
          margin-bottom: 0.25rem;
        }

        .trust-desc {
          font-size: 0.775rem;
          line-height: 1.4;
          color: #9ca3af;
        }

        @media (max-width: 640px) {
          .preorder-hero-container {
            padding: 2rem 1rem 1.75rem;
          }
          .trust-grid {
            grid-template-columns: 1fr;
            padding: 1rem;
            gap: 1rem;
          }
        }
      `}</style>
    </section>
  );
}
