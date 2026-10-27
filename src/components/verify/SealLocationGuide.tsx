"use client";

import React, { useState } from "react";
import { HolographicSealPreview } from "@/components/trust";

export function SealLocationGuide() {
  const [activeTab, setActiveTab] = useState<"LOCATION" | "TAMPER_CHECK" | "SERIAL_FORMAT">("LOCATION");

  return (
    <div className="location-guide-container">
      <div className="guide-header">
        <div>
          <h3 className="guide-title">How to Locate & Verify Your Seal</h3>
          <p className="guide-subtitle">
            Every NCAMart package carries an official destructive tamper-evident seal inspected at our Nawabpur Godown.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="tab-pill-group">
          <button
            type="button"
            className={`tab-btn ${activeTab === "LOCATION" ? "active" : ""}`}
            onClick={() => setActiveTab("LOCATION")}
          >
            Seal Placement
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "TAMPER_CHECK" ? "active" : ""}`}
            onClick={() => setActiveTab("TAMPER_CHECK")}
          >
            Tamper Void Test
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "SERIAL_FORMAT" ? "active" : ""}`}
            onClick={() => setActiveTab("SERIAL_FORMAT")}
          >
            Base32 Format
          </button>
        </div>
      </div>

      <div className="guide-grid">
        {/* Left: 3D Holographic Seal Preview */}
        <div className="seal-display-col">
          <div className="preview-card-wrap">
            <HolographicSealPreview
              sealId="NCA-9X4K-2M7B"
              productTier="AUTHENTIC"
              brandName="Baseus / UGREEN"
              title="Official Nawabpur Godown QC Certified"
              qcDate="Oct 27, 2026, 14:15 BST"
            />
          </div>
        </div>

        {/* Right: Explanatory Step Cards */}
        <div className="guide-info-col">
          {activeTab === "LOCATION" && (
            <div className="info-tab-content">
              <div className="step-card">
                <div className="step-num">1</div>
                <div>
                  <h4 className="step-heading">Parcel Corner Seams</h4>
                  <p className="step-text">
                    Look for the 50x30 mm holographic sticker placed directly across the opening seam of your parcel or manufacturer box.
                  </p>
                </div>
              </div>

              <div className="step-card">
                <div className="step-num">2</div>
                <div>
                  <h4 className="step-heading">Printed Crockford Base32 ID</h4>
                  <p className="step-text">
                    Directly below the QR code, find the 8-character identifier in <code>NCA-XXXX-XXXX</code> format (e.g., <code>NCA-9X4K-2M7B</code>).
                  </p>
                </div>
              </div>

              <div className="step-card">
                <div className="step-num">3</div>
                <div>
                  <h4 className="step-heading">Laser QR Code</h4>
                  <p className="step-text">
                    Scan with any smartphone camera to open the instant verification link directly without typing.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "TAMPER_CHECK" && (
            <div className="info-tab-content">
              <div className="alert-card void-card">
                <div className="alert-icon-wrap">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div>
                  <h4 className="alert-title">Destructive Substrate Layer</h4>
                  <p className="alert-text">
                    Once applied, any attempt to peel, slice, or reseal causes the tamper layer to disintegrate, permanently leaving a checkered <strong>"VOID OPENED"</strong> pattern on the box.
                  </p>
                </div>
              </div>

              <div className="step-card">
                <div className="step-num">!</div>
                <div>
                  <h4 className="step-heading">If Seal is Broken Upon Delivery</h4>
                  <p className="step-text">
                    Do not accept the delivery from the courier. Note "Broken VOID Seal" on the delivery slip and contact NCAMart Support immediately for instant priority replacement.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "SERIAL_FORMAT" && (
            <div className="info-tab-content">
              <div className="step-card">
                <div className="step-num">A</div>
                <div>
                  <h4 className="step-heading">Zero Ambiguity Alphabet</h4>
                  <p className="step-text">
                    Crockford Base32 strictly excludes confusing letters: <strong>I</strong> (looks like 1), <strong>L</strong> (looks like 1), <strong>O</strong> (looks like 0), and <strong>U</strong> (avoiding accidental foul words).
                  </p>
                </div>
              </div>

              <div className="step-card">
                <div className="step-num">B</div>
                <div>
                  <h4 className="step-heading">Auto-Correction Built-In</h4>
                  <p className="step-text">
                    If you mistakenly type &quot;O&quot;, our search mask automatically converts it to &quot;0&quot;. Typing &quot;I&quot; or &quot;L&quot; converts directly to &quot;1&quot;.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .location-guide-container {
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1.25rem;
          padding: 2rem;
          backdrop-filter: blur(12px);
        }

        .guide-header {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1.25rem;
          margin-bottom: 2rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 1.25rem;
        }

        .guide-title {
          font-size: 1.25rem;
          font-weight: 800;
          color: #f3f4f6;
          margin: 0 0 0.35rem;
        }

        .guide-subtitle {
          font-size: 0.84rem;
          color: #9ca3af;
          margin: 0;
          line-height: 1.45;
        }

        .tab-pill-group {
          display: flex;
          background: rgba(0, 0, 0, 0.35);
          padding: 0.25rem;
          border-radius: 0.625rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .tab-btn {
          background: transparent;
          border: none;
          color: #9ca3af;
          font-size: 0.775rem;
          font-weight: 600;
          padding: 0.4rem 0.875rem;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .tab-btn:hover {
          color: #ffffff;
        }

        .tab-btn.active {
          background: #2563eb;
          color: #ffffff;
        }

        .guide-grid {
          display: grid;
          grid-template-columns: 1fr 1.15fr;
          gap: 2rem;
          align-items: start;
        }

        .preview-card-wrap {
          border-radius: 1rem;
          overflow: hidden;
        }

        .guide-info-col {
          display: flex;
          flex-direction: column;
        }

        .info-tab-content {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .step-card {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 0.75rem;
          padding: 1rem 1.25rem;
        }

        .step-num {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.35);
          color: #60a5fa;
          font-size: 0.875rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .step-heading {
          font-size: 0.9375rem;
          font-weight: 700;
          color: #f3f4f6;
          margin: 0 0 0.25rem;
        }

        .step-text {
          font-size: 0.8125rem;
          color: #9ca3af;
          margin: 0;
          line-height: 1.45;
        }

        .step-text code {
          background: rgba(0, 0, 0, 0.4);
          color: #60a5fa;
          padding: 0.15rem 0.35rem;
          border-radius: 4px;
          font-family: var(--font-mono, monospace);
        }

        .alert-card {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          border-radius: 0.75rem;
          padding: 1.25rem;
        }

        .void-card {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .alert-icon-wrap {
          flex-shrink: 0;
        }

        .alert-title {
          font-size: 0.9375rem;
          font-weight: 800;
          color: #fca5a5;
          margin: 0 0 0.35rem;
        }

        .alert-text {
          font-size: 0.8125rem;
          color: #cbd5e1;
          margin: 0;
          line-height: 1.45;
        }

        @media (max-width: 768px) {
          .guide-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
