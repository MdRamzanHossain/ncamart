"use client";

import React from "react";

export interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
  onStepClick?: (step: 1 | 2 | 3) => void;
}

export function StepIndicator({ currentStep, onStepClick }: StepIndicatorProps) {
  const steps = [
    { num: 1, label: "Identity & Phone", desc: "OTP Verification" },
    { num: 2, label: "Shipping Address", desc: "Geo Cascade & Tax" },
    { num: 3, label: "Order Review", desc: "Coupons & Summary" },
  ];

  return (
    <div style={{ width: "100%", paddingBottom: "24px" }}>
      {/* Step Numbers and Line */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
          maxWidth: "680px",
          margin: "0 auto",
        }}
      >
        {/* Background Connecting Line */}
        <div
          style={{
            position: "absolute",
            top: "18px",
            left: "40px",
            right: "40px",
            height: "2px",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            zIndex: 1,
          }}
        >
          {/* Active Progress Fill */}
          <div
            style={{
              height: "100%",
              width: currentStep === 1 ? "0%" : currentStep === 2 ? "50%" : "100%",
              backgroundColor: "#3b82f6",
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {steps.map((s) => {
          const isCompleted = currentStep > s.num;
          const isActive = currentStep === s.num;
          const isClickable = s.num < currentStep && onStepClick;

          return (
            <div
              key={s.num}
              onClick={() => isClickable && onStepClick(s.num as 1 | 2 | 3)}
              style={{
                position: "relative",
                zIndex: 2,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
                cursor: isClickable ? "pointer" : "default",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  fontWeight: 800,
                  transition: "all 0.25s ease",
                  backgroundColor: isCompleted
                    ? "#10b981"
                    : isActive
                    ? "#3b82f6"
                    : "#1e293b",
                  color: isCompleted || isActive ? "#ffffff" : "#94a3b8",
                  border: isActive
                    ? "2px solid #60a5fa"
                    : isCompleted
                    ? "2px solid #10b981"
                    : "1px solid rgba(255, 255, 255, 0.15)",
                  boxShadow: isActive
                    ? "0 0 14px rgba(59, 130, 246, 0.5)"
                    : isCompleted
                    ? "0 0 10px rgba(16, 185, 129, 0.3)"
                    : "none",
                }}
              >
                {isCompleted ? "✓" : s.num}
              </div>

              <div style={{ textAlign: "center" }}>
                <span
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "#f8fafc" : isCompleted ? "#cbd5e1" : "#64748b",
                  }}
                >
                  {s.label}
                </span>
                <span style={{ display: "block", fontSize: "10px", color: "#64748b" }}>
                  {s.desc}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
