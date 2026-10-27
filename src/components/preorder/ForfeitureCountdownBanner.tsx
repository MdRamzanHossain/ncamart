"use client";

import React, { useState, useEffect } from "react";

export interface ForfeitureCountdownBannerProps {
  arrivalDate?: Date; // Godown arrival timestamp
  forfeitureDaysWindow?: number; // 7 days per PRD §3.4
  onExpired?: () => void;
}

export function ForfeitureCountdownBanner({
  arrivalDate,
  forfeitureDaysWindow = 7,
  onExpired,
}: ForfeitureCountdownBannerProps) {
  // Default to 4 days, 12 hours remaining for demo/initial view
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  }>({
    days: 4,
    hours: 11,
    minutes: 42,
    seconds: 18,
    isExpired: false,
  });

  useEffect(() => {
    // If arrivalDate is provided, calculate exact delta
    const targetTime = arrivalDate
      ? new Date(arrivalDate.getTime() + forfeitureDaysWindow * 24 * 60 * 60 * 1000).getTime()
      : Date.now() + (4 * 24 * 3600 + 11 * 3600 + 42 * 60 + 18) * 1000;

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        clearInterval(interval);
        if (onExpired) onExpired();
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [arrivalDate, forfeitureDaysWindow, onExpired]);

  const isUrgent = timeLeft.days < 2;

  return (
    <div className={`forfeiture-banner ${isUrgent ? "urgent-mode" : "standard-mode"}`}>
      <div className="banner-left">
        <div className="clock-icon-wrap">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div className="banner-text">
          <h4 className="banner-title">
            {isUrgent ? "CRITICAL: Reservation Forfeiture Approaching" : "7-Day Balance Settlement Window Active"}
          </h4>
          <p className="banner-subtitle">
            Please settle the remaining balance within{" "}
            <strong>
              {timeLeft.days} days {timeLeft.hours} hours {timeLeft.minutes} minutes
            </strong>{" "}
            to avoid reservation forfeiture.
          </p>
          <p className="banner-policy-note">
            PRD Policy: Unclaimed units after 7 days are released to general catalog; deposit credited to store credit minus 10% restocking fee.
          </p>
        </div>
      </div>

      {/* Real-Time Digits Countdown Block */}
      <div className="countdown-clock">
        <div className="time-digit-box">
          <span className="digit-val">{String(timeLeft.days).padStart(2, "0")}</span>
          <span className="digit-lbl">Days</span>
        </div>
        <span className="digit-sep">:</span>
        <div className="time-digit-box">
          <span className="digit-val">{String(timeLeft.hours).padStart(2, "0")}</span>
          <span className="digit-lbl">Hours</span>
        </div>
        <span className="digit-sep">:</span>
        <div className="time-digit-box">
          <span className="digit-val">{String(timeLeft.minutes).padStart(2, "0")}</span>
          <span className="digit-lbl">Mins</span>
        </div>
        <span className="digit-sep">:</span>
        <div className="time-digit-box">
          <span className="digit-val">{String(timeLeft.seconds).padStart(2, "0")}</span>
          <span className="digit-lbl">Secs</span>
        </div>
      </div>

      <style jsx>{`
        .forfeiture-banner {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 1.25rem;
          padding: 1.25rem 1.5rem;
          border-radius: 1rem;
          backdrop-filter: blur(12px);
          transition: all 0.25s ease;
        }

        .standard-mode {
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.35);
          color: #fef3c7;
        }

        .urgent-mode {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.45);
          color: #fee2e2;
          box-shadow: 0 0 20px rgba(239, 68, 68, 0.2);
        }

        .banner-left {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          flex: 1;
          min-width: 280px;
        }

        .clock-icon-wrap {
          width: 42px;
          height: 42px;
          border-radius: 0.625rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #fbbf24;
        }

        .urgent-mode .clock-icon-wrap {
          color: #f87171;
        }

        .banner-title {
          font-size: 1rem;
          font-weight: 800;
          margin: 0 0 0.25rem;
          color: #ffffff;
          letter-spacing: -0.01em;
        }

        .banner-subtitle {
          font-size: 0.875rem;
          margin: 0 0 0.35rem;
          line-height: 1.45;
        }

        .banner-subtitle strong {
          color: #ffffff;
        }

        .banner-policy-note {
          font-size: 0.75rem;
          opacity: 0.85;
          margin: 0;
          line-height: 1.35;
        }

        .countdown-clock {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: rgba(0, 0, 0, 0.4);
          padding: 0.5rem 0.875rem;
          border-radius: 0.75rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .time-digit-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 38px;
        }

        .digit-val {
          font-size: 1.25rem;
          font-weight: 800;
          font-family: var(--font-mono, monospace);
          color: #ffffff;
          line-height: 1.1;
        }

        .digit-lbl {
          font-size: 0.65rem;
          text-transform: uppercase;
          opacity: 0.7;
          letter-spacing: 0.05em;
        }

        .digit-sep {
          font-size: 1.125rem;
          font-weight: 700;
          opacity: 0.5;
          margin-bottom: 0.6rem;
        }

        @media (max-width: 640px) {
          .forfeiture-banner {
            flex-direction: column;
            align-items: flex-start;
          }
          .countdown-clock {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
