"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalAppError({ error, reset }: ErrorProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timestamp, setTimestamp] = useState<string>("");

  useEffect(() => {
    // Log the error to console or error reporter
    console.error("NCAMart Global App Error:", error);
    setTimestamp(new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka" }));
  }, [error]);

  const handleCopyDiagnostics = () => {
    const diagnostics = [
      `NCAMart Error Report`,
      `Time: ${timestamp || new Date().toISOString()} (Asia/Dhaka)`,
      `Digest: ${error.digest || "N/A"}`,
      `Message: ${error.message || "Unknown client exception"}`,
      `URL: ${typeof window !== "undefined" ? window.location.href : "SSR"}`,
      `User Agent: ${typeof navigator !== "undefined" ? navigator.userAgent : "N/A"}`,
    ].join("\n");

    if (navigator.clipboard) {
      navigator.clipboard.writeText(diagnostics).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    }
  };

  return (
    <main className="error-boundary-root" id="main-content">
      {/* Background ambient lighting */}
      <div className="ambient-glow glow-crimson" />
      <div className="ambient-glow glow-amber" />
      <div className="circuit-pattern-overlay" />

      <div className="error-card">
        {/* Animated Holographic Disconnection Hologram */}
        <div className="status-emblem-wrap">
          <div className="pulse-ring ring-outer" />
          <div className="pulse-ring ring-middle" />
          <div className="emblem-core">
            <svg
              className="glitch-icon"
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
        </div>

        {/* Badge & Title */}
        <div className="badge-row">
          <span className="badge-pill">
            <span className="dot-blink" />
            SYSTEM EXCEPTION 500
          </span>
          <span className="badge-sub">Nawabpur Telemetry Guard</span>
        </div>

        <h1 className="error-heading">
          System Disruption Encountered
          <span className="heading-sub-bn">সিস্টেমে অপ্রত্যাশিত সমস্যা দেখা দিয়েছে</span>
        </h1>

        <p className="error-description">
          A temporary network interruption or hardware telemetry glitch interrupted your connection to the
          Nawabpur Complex engine. Your cart and session data remain securely intact.
        </p>

        {/* Primary Action Buttons */}
        <div className="button-group">
          <button
            type="button"
            onClick={() => reset()}
            className="btn btn-primary"
            id="error-try-again-btn"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            <span>Try Again (পুনরায় চেষ্টা করুন)</span>
          </button>

          <Link href="/" className="btn btn-secondary" id="error-home-btn">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span>Go to Storefront (মূল পাতায় ফিরুন)</span>
          </Link>
        </div>

        {/* Help & Support Strip */}
        <div className="support-strip">
          <span className="support-title">Need Immediate Assistance?</span>
          <div className="support-links">
            <a
              href="https://wa.me/8801700000000?text=Hello%20NCAMart%2C%20I%20faced%20an%20error"
              target="_blank"
              rel="noopener noreferrer"
              className="support-chip"
            >
              <span className="chip-icon">💬</span>
              <span>WhatsApp Hotline</span>
            </a>
            <Link href="/verify" className="support-chip">
              <span className="chip-icon">🛡️</span>
              <span>Verify Hologram</span>
            </Link>
            <a href="tel:+88029550000" className="support-chip">
              <span className="chip-icon">📞</span>
              <span>Nawabpur Helpdesk</span>
            </a>
          </div>
        </div>

        {/* Collapsible Technical Diagnostics */}
        <div className="diagnostics-wrapper">
          <button
            type="button"
            className="diagnostics-toggle"
            onClick={() => setShowDetails(!showDetails)}
            aria-expanded={showDetails}
            aria-controls="technical-diagnostics"
          >
            <span className="toggle-label">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ transform: showDetails ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              Technical Diagnostics & Digest ID
            </span>
            {error.digest && <span className="digest-chip">Digest: {error.digest.slice(0, 8)}…</span>}
          </button>

          {showDetails && (
            <div id="technical-diagnostics" className="diagnostics-panel">
              <div className="diagnostics-header">
                <span className="diag-time">Logged: {timestamp || "Live Session"}</span>
                <button
                  type="button"
                  onClick={handleCopyDiagnostics}
                  className="copy-diag-btn"
                  title="Copy technical details to clipboard"
                >
                  {copied ? "✓ Copied to Clipboard" : "📋 Copy Diagnostics"}
                </button>
              </div>

              <div className="code-block">
                <div className="code-row">
                  <span className="code-key">Error Message:</span>
                  <span className="code-val">{error.message || "Unknown runtime rejection"}</span>
                </div>
                {error.digest && (
                  <div className="code-row">
                    <span className="code-key">Digest Ref:</span>
                    <span className="code-val">{error.digest}</span>
                  </div>
                )}
                {error.stack && (
                  <pre className="stack-trace">
                    {error.stack.split("\n").slice(0, 4).join("\n")}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .error-boundary-root {
          min-height: calc(100vh - 80px);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: 40px 16px 80px 16px;
          background-color: var(--bg-base, #0b0f19);
          overflow: hidden;
          font-family: var(--font-body, inherit);
        }

        .ambient-glow {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          pointer-events: none;
          z-index: 0;
          opacity: 0.15;
        }

        .glow-crimson {
          width: 500px;
          height: 500px;
          background: #ef4444;
          top: 10%;
          left: 15%;
          animation: floatGlow 14s ease-in-out infinite alternate;
        }

        .glow-amber {
          width: 450px;
          height: 450px;
          background: #f59e0b;
          bottom: 10%;
          right: 15%;
          animation: floatGlow 12s ease-in-out infinite alternate-reverse;
        }

        @keyframes floatGlow {
          0% {
            transform: translate(0, 0) scale(1);
          }
          100% {
            transform: translate(40px, 30px) scale(1.15);
          }
        }

        .circuit-pattern-overlay {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 28px 28px;
          pointer-events: none;
          z-index: 1;
        }

        .error-card {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 680px;
          background: var(--bg-surface, #111827);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: var(--radius-2xl, 24px);
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7),
                      0 0 35px -5px rgba(239, 68, 68, 0.15);
          padding: 48px 36px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          backdrop-filter: blur(16px);
        }

        .status-emblem-wrap {
          position: relative;
          width: 96px;
          height: 96px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
        }

        .pulse-ring {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(239, 68, 68, 0.4);
          animation: ringPulse 3s cubic-bezier(0.16, 1, 0.3, 1) infinite;
        }

        .ring-outer {
          width: 100%;
          height: 100%;
          animation-delay: 0s;
        }

        .ring-middle {
          width: 80%;
          height: 80%;
          animation-delay: 0.6s;
        }

        @keyframes ringPulse {
          0% {
            transform: scale(0.85);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.15);
            opacity: 0.3;
          }
          100% {
            transform: scale(0.85);
            opacity: 0.8;
          }
        }

        .emblem-core {
          width: 68px;
          height: 68px;
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(185, 28, 28, 0.4) 100%);
          border: 1.5px solid rgba(239, 68, 68, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #f87171;
          box-shadow: 0 8px 24px -4px rgba(239, 68, 68, 0.4);
          animation: glitchShake 6s infinite;
        }

        @keyframes glitchShake {
          0%, 92%, 100% {
            transform: translate(0, 0);
          }
          93% {
            transform: translate(-2px, 1px);
          }
          95% {
            transform: translate(2px, -1px);
          }
          97% {
            transform: translate(-1px, 2px);
          }
        }

        .badge-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
        }

        .badge-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.35);
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.05em;
          color: #fca5a5;
          text-transform: uppercase;
        }

        .dot-blink {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #ef4444;
          animation: blink 1.2s infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .badge-sub {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-tertiary, #94a3b8);
          letter-spacing: 0.03em;
        }

        .error-heading {
          font-size: 26px;
          font-weight: 800;
          color: var(--text-primary, #f9fafb);
          line-height: 1.25;
          margin: 0 0 8px 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .heading-sub-bn {
          font-size: 17px;
          font-weight: 600;
          color: #f87171;
          font-family: inherit;
        }

        .error-description {
          font-size: 14px;
          line-height: 1.6;
          color: var(--text-secondary, #9ca3af);
          margin: 8px 0 28px 0;
          max-width: 520px;
        }

        .button-group {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          flex-wrap: wrap;
          width: 100%;
          margin-bottom: 28px;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 22px;
          border-radius: var(--radius-lg, 12px);
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          text-decoration: none;
        }

        .btn-primary {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 4px 18px rgba(239, 68, 68, 0.35);
        }

        .btn-primary:hover {
          background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
          transform: translateY(-1.5px);
          box-shadow: 0 6px 22px rgba(239, 68, 68, 0.45);
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-primary, #f9fafb);
          border: 1px solid var(--border-glow, rgba(255, 255, 255, 0.14));
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.09);
          transform: translateY(-1.5px);
          border-color: rgba(255, 255, 255, 0.25);
        }

        .support-strip {
          width: 100%;
          padding: 16px 20px;
          border-radius: var(--radius-md, 12px);
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          margin-bottom: 24px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          align-items: center;
        }

        .support-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-tertiary, #94a3b8);
        }

        .support-links {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .support-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary, #cbd5e1);
          text-decoration: none;
          transition: background 0.15s ease, border-color 0.15s ease;
        }

        .support-chip:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.18);
          color: #ffffff;
        }

        .chip-icon {
          font-size: 13px;
        }

        .diagnostics-wrapper {
          width: 100%;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding-top: 16px;
        }

        .diagnostics-toggle {
          width: 100%;
          background: none;
          border: none;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 4px;
          color: var(--text-tertiary, #94a3b8);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .diagnostics-toggle:hover {
          color: var(--text-secondary, #e2e8f0);
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .digest-chip {
          font-family: monospace;
          font-size: 10px;
          background: rgba(255, 255, 255, 0.05);
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .diagnostics-panel {
          margin-top: 12px;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 10px;
          padding: 14px;
          text-align: left;
        }

        .diagnostics-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
          font-size: 11px;
          color: var(--text-tertiary, #94a3b8);
        }

        .copy-diag-btn {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
          padding: 3px 8px;
          font-size: 10px;
          font-weight: 700;
          color: var(--text-secondary, #cbd5e1);
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .copy-diag-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
        }

        .code-block {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 11px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          overflow-x: auto;
        }

        .code-row {
          display: flex;
          gap: 8px;
        }

        .code-key {
          color: #94a3b8;
          min-width: 95px;
          flex-shrink: 0;
        }

        .code-val {
          color: #fca5a5;
          word-break: break-all;
        }

        .stack-trace {
          margin: 6px 0 0 0;
          padding: 8px;
          background: rgba(0, 0, 0, 0.5);
          border-radius: 6px;
          color: #94a3b8;
          font-size: 10px;
          line-height: 1.4;
          white-space: pre-wrap;
          border-left: 2px solid #ef4444;
        }

        @media (max-width: 640px) {
          .error-card {
            padding: 36px 20px;
          }

          .error-heading {
            font-size: 22px;
          }

          .heading-sub-bn {
            font-size: 15px;
          }

          .button-group {
            flex-direction: column;
          }

          .btn {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
