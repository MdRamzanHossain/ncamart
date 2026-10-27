"use client";

import React from "react";

export interface MilestoneStage {
  step: number;
  title: string;
  subtitle: string;
  status: "COMPLETED" | "CURRENT" | "UPCOMING";
  eta?: string;
  notes?: string;
}

export interface MilestoneTrackerProps {
  currentStageIndex?: number; // 0 to 4
  arrivalWindow?: string;
  batchCode?: string;
}

export function MilestoneTracker({
  currentStageIndex = 1,
  arrivalWindow = "Nov 12 – Nov 18, 2026",
  batchCode = "AF-DH-2026-B08",
}: MilestoneTrackerProps) {
  const stages: MilestoneStage[] = [
    {
      step: 1,
      title: "Deposit Confirmed",
      subtitle: "10%–20% advance locked, slot registered",
      status: currentStageIndex > 0 ? "COMPLETED" : currentStageIndex === 0 ? "CURRENT" : "UPCOMING",
      notes: "Full refund if cancelled before cargo flight booking",
    },
    {
      step: 2,
      title: "Batch Quota Reached",
      subtitle: `Target units locked in Batch ${batchCode}`,
      status: currentStageIndex > 1 ? "COMPLETED" : currentStageIndex === 1 ? "CURRENT" : "UPCOMING",
      notes: "Direct factory dispatch to international freight terminal",
    },
    {
      step: 3,
      title: "Air-Freight in Transit",
      subtitle: "International air cargo flight to Dhaka",
      status: currentStageIndex > 2 ? "COMPLETED" : currentStageIndex === 2 ? "CURRENT" : "UPCOMING",
      eta: arrivalWindow,
      notes: "Customs declaration & BTRC inspection process",
    },
    {
      step: 4,
      title: "Godown Arrival & QC",
      subtitle: "Bench-tested & Holographic Seal applied",
      status: currentStageIndex > 3 ? "COMPLETED" : currentStageIndex === 3 ? "CURRENT" : "UPCOMING",
      notes: "Customer notified; 7-day balance settlement window begins",
    },
    {
      step: 5,
      title: "Balance & Handover",
      subtitle: "Doorstep courier or Showroom PIN pickup",
      status: currentStageIndex > 4 ? "COMPLETED" : currentStageIndex === 4 ? "CURRENT" : "UPCOMING",
      notes: "Official Mushak 6.3 Tax Invoice & warranty activation",
    },
  ];

  return (
    <div className="milestone-tracker-card">
      <div className="tracker-header">
        <div>
          <h3 className="tracker-title">Import & Clearance Milestone Pathway</h3>
          <p className="tracker-desc">
            Track your unit from Asian tech hubs directly to Nawabpur Complex. Full transparency at every milestone.
          </p>
        </div>
        <span className="batch-pill">Batch {batchCode}</span>
      </div>

      <div className="milestone-steps-container">
        {stages.map((stage, idx) => {
          const isCompleted = stage.status === "COMPLETED";
          const isCurrent = stage.status === "CURRENT";

          return (
            <div key={stage.step} className={`milestone-step-item ${isCurrent ? "is-current" : ""} ${isCompleted ? "is-completed" : ""}`}>
              {/* Connector line (except for last step) */}
              {idx < stages.length - 1 && (
                <div
                  className={`step-connector ${isCompleted ? "connector-filled" : ""}`}
                />
              )}

              {/* Step Icon / Number Indicator */}
              <div className="step-indicator">
                {isCompleted ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : isCurrent ? (
                  <span className="current-pulse-ring" />
                ) : (
                  <span>{stage.step}</span>
                )}
              </div>

              {/* Step Content */}
              <div className="step-content">
                <div className="step-top-line">
                  <h4 className="step-title">{stage.title}</h4>
                  {stage.eta && <span className="step-eta-badge">{stage.eta}</span>}
                </div>
                <p className="step-subtitle">{stage.subtitle}</p>
                {stage.notes && <p className="step-notes">{stage.notes}</p>}
              </div>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .milestone-tracker-card {
          background: rgba(15, 23, 42, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1rem;
          padding: 1.5rem;
          backdrop-filter: blur(12px);
        }

        .tracker-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.75rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          padding-bottom: 1rem;
        }

        .tracker-title {
          font-size: 1.0625rem;
          font-weight: 700;
          color: #f3f4f6;
          margin: 0 0 0.25rem;
        }

        .tracker-desc {
          font-size: 0.8125rem;
          color: #9ca3af;
          margin: 0;
          line-height: 1.4;
        }

        .batch-pill {
          font-size: 0.725rem;
          font-weight: 600;
          font-family: var(--font-mono, monospace);
          color: #93c5fd;
          background: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.3);
          padding: 0.25rem 0.6rem;
          border-radius: 9999px;
          white-space: nowrap;
        }

        .milestone-steps-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          position: relative;
        }

        .milestone-step-item {
          display: flex;
          align-items: flex-start;
          gap: 1.125rem;
          position: relative;
        }

        .step-connector {
          position: absolute;
          top: 30px;
          left: 14px;
          width: 2px;
          height: calc(100% + 0.5rem);
          background: rgba(255, 255, 255, 0.1);
          z-index: 0;
        }

        .step-connector.connector-filled {
          background: #10b981;
        }

        .step-indicator {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          border: 2px solid rgba(255, 255, 255, 0.2);
          color: #9ca3af;
          font-size: 0.8125rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          position: relative;
          z-index: 1;
        }

        .milestone-step-item.is-completed .step-indicator {
          background: #10b981;
          border-color: #10b981;
          color: #ffffff;
        }

        .milestone-step-item.is-current .step-indicator {
          background: #3b82f6;
          border-color: #60a5fa;
          color: #ffffff;
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.6);
        }

        .current-pulse-ring {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #ffffff;
          animation: ringPulse 1.6s infinite;
        }

        @keyframes ringPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }

        .step-content {
          flex: 1;
        }

        .step-top-line {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          margin-bottom: 0.2rem;
        }

        .step-title {
          font-size: 0.9375rem;
          font-weight: 700;
          color: #f3f4f6;
          margin: 0;
        }

        .milestone-step-item.is-current .step-title {
          color: #60a5fa;
        }

        .step-eta-badge {
          font-size: 0.7rem;
          font-weight: 600;
          color: #fbbf24;
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.3);
          padding: 0.15rem 0.5rem;
          border-radius: 4px;
        }

        .step-subtitle {
          font-size: 0.8125rem;
          color: #d1d5db;
          margin: 0 0 0.2rem;
        }

        .step-notes {
          font-size: 0.725rem;
          color: #9ca3af;
          margin: 0;
          line-height: 1.35;
        }

        @media (min-width: 768px) {
          .milestone-steps-container {
            flex-direction: row;
            gap: 1rem;
          }

          .milestone-step-item {
            flex-direction: column;
            flex: 1;
            align-items: center;
            text-align: center;
            gap: 0.75rem;
          }

          .step-connector {
            top: 14px;
            left: 50%;
            width: 100%;
            height: 2px;
          }

          .step-top-line {
            flex-direction: column;
            gap: 0.25rem;
          }
        }
      `}</style>
    </div>
  );
}
