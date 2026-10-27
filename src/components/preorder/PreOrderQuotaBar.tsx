"use client";

import React, { useEffect, useState } from "react";
import { calculateQuotaProgress } from "./types";

export interface PreOrderQuotaBarProps {
  reserved: number;
  target: number;
  batchCode?: string;
  showDetails?: boolean;
}

export function PreOrderQuotaBar({
  reserved,
  target,
  batchCode,
  showDetails = true,
}: PreOrderQuotaBarProps) {
  const { percentage, isFilled, remaining } = calculateQuotaProgress(reserved, target);
  const [animatedWidth, setAnimatedWidth] = useState(0);

  // Trigger smooth fill animation on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedWidth(percentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  const isNearlyFull = percentage >= 75 && !isFilled;

  return (
    <div className="quota-bar-wrapper">
      <div className="quota-header">
        <div className="quota-label-group">
          <span className="quota-main-text">
            <strong>{reserved} of {target} units</strong> reserved
          </span>
          {batchCode && (
            <span className="batch-tag">Batch {batchCode}</span>
          )}
        </div>
        <div className="quota-status-pill">
          {isFilled ? (
            <span className="pill-filled">Batch Target Met</span>
          ) : isNearlyFull ? (
            <span className="pill-urgent">
              <span className="pulse-dot" /> Only {remaining} left!
            </span>
          ) : (
            <span className="pill-open">{percentage}% filled</span>
          )}
        </div>
      </div>

      {/* Progress Track */}
      <div className="progress-track" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`progress-fill ${isFilled ? "is-filled" : isNearlyFull ? "is-nearly-full" : ""}`}
          style={{ width: `${animatedWidth}%` }}
        />
      </div>

      {showDetails && (
        <p className="quota-subtext">
          {isFilled
            ? "Air-freight batch quota completed. Flight booked from Asian cargo hub."
            : `${remaining} more reservation${remaining > 1 ? "s" : ""} required to trigger batch air-freight import.`}
        </p>
      )}

      <style jsx>{`
        .quota-bar-wrapper {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          width: 100%;
        }

        .quota-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.8125rem;
        }

        .quota-label-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .quota-main-text {
          color: var(--color-text-primary, #f3f4f6);
        }

        .batch-tag {
          font-size: 0.7rem;
          background: rgba(255, 255, 255, 0.08);
          color: #9ca3af;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          font-family: var(--font-mono, monospace);
        }

        .quota-status-pill {
          font-size: 0.75rem;
          font-weight: 600;
        }

        .pill-filled {
          color: #34d399;
          background: rgba(16, 185, 129, 0.15);
          padding: 0.2rem 0.5rem;
          border-radius: 9999px;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .pill-urgent {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          color: #fbbf24;
          background: rgba(245, 158, 11, 0.15);
          padding: 0.2rem 0.5rem;
          border-radius: 9999px;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .pulse-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #fbbf24;
          box-shadow: 0 0 6px #fbbf24;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }

        .pill-open {
          color: #93c5fd;
        }

        .progress-track {
          width: 100%;
          height: 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 9999px;
          overflow: hidden;
          position: relative;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
          border-radius: 9999px;
          transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .progress-fill.is-nearly-full {
          background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%);
        }

        .progress-fill.is-filled {
          background: linear-gradient(90deg, #10b981 0%, #34d399 100%);
        }

        .quota-subtext {
          font-size: 0.75rem;
          color: var(--color-text-muted, #9ca3af);
          line-height: 1.4;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
