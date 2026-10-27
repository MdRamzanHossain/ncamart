"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface PullToRefreshProps {
  children: React.ReactNode;
}

const PULL_THRESHOLD = 70;
const MAX_PULL = 110;

export function PullToRefresh({ children }: PullToRefreshProps) {
  const router = useRouter();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (typeof window !== "undefined" && window.scrollY === 0) {
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPullingRef.current || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    if (diff > 0 && typeof window !== "undefined" && window.scrollY === 0) {
      // Apply rubber-band damping
      const damping = 0.42;
      const distance = Math.min(diff * damping, MAX_PULL);
      setPullDistance(distance);
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = useCallback(() => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(50); // Keep spinner visible during refresh

      // Trigger route refresh
      try {
        router.refresh();
      } catch {
        // ignore
      }

      // Reset after 800ms
      setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      }, 800);
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, isRefreshing, router]);

  // Clean up if touch is cancelled
  useEffect(() => {
    const handleCancel = () => {
      isPullingRef.current = false;
      setPullDistance(0);
    };
    window.addEventListener("touchend", handleCancel);
    return () => window.removeEventListener("touchend", handleCancel);
  }, []);

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const rotateDeg = progress * 360;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: "relative",
        minHeight: "100%",
      }}
    >
      {/* Pull Indicator Pill */}
      {pullDistance > 0 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: `${pullDistance}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            pointerEvents: "none",
            zIndex: 40,
            transition: isPullingRef.current ? "none" : "height var(--duration-fast) ease",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              backgroundColor: "var(--bg-surface-elevated)",
              border: "1.5px solid var(--border-default)",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${Math.max(0.6, progress)})`,
              transition: "transform var(--duration-fast) ease",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--tier-authentic-gold)"
              strokeWidth="2.5"
              style={{
                transform: isRefreshing ? "none" : `rotate(${rotateDeg}deg)`,
                animation: isRefreshing ? "spin 0.7s linear infinite" : "none",
              }}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </div>
        </div>
      )}

      {/* Main Content with subtle push-down while pulling */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.4}px)` : "none",
          transition: isPullingRef.current ? "none" : "transform var(--duration-fast) ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}
