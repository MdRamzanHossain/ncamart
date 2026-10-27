"use client";

import React, { useState } from "react";
import { useToast } from "@/components/ui/toast";

interface WishlistHeartButtonProps {
  productId: string;
  skuId?: string;
  productTitle: string;
  initialSaved?: boolean;
  size?: "sm" | "md" | "lg";
  onToggle?: (isSaved: boolean) => void;
}

export function WishlistHeartButton({
  productId,
  skuId,
  productTitle,
  initialSaved = false,
  size = "md",
  onToggle,
}: WishlistHeartButtonProps) {
  const [isSaved, setIsSaved] = useState(initialSaved);
  const [isAnimating, setIsAnimating] = useState(false);
  const { addToast } = useToast();

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const nextState = !isSaved;
    setIsSaved(nextState);
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 500);

    if (nextState) {
      addToast({
        title: "Saved to Wishlist",
        description: `Added "${productTitle}" to your saved tech collection. Price-drop alerts enabled.`,
        variant: "success",
      });
    } else {
      addToast({
        title: "Removed from Wishlist",
        description: `Removed "${productTitle}" from your saved items.`,
        variant: "info",
      });
    }

    if (onToggle) {
      onToggle(nextState);
    }

    // Dispatch global custom event for Navbar counter synchronization
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ncamart:wishlist-updated", {
          detail: {
            productId,
            skuId,
            isSaved: nextState,
          },
        })
      );
    }
  };

  const sizePixels = size === "sm" ? 32 : size === "lg" ? 44 : 38;
  const iconPixels = size === "sm" ? 16 : size === "lg" ? 22 : 18;

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isSaved ? `Remove ${productTitle} from wishlist` : `Add ${productTitle} to wishlist`}
      aria-pressed={isSaved}
      className={`wishlist-heart-btn ${isSaved ? "saved" : ""} ${isAnimating ? "pop-anim" : ""}`}
      style={{
        width: `${sizePixels}px`,
        height: `${sizePixels}px`,
      }}
      data-testid="wishlist-heart-btn"
    >
      <svg
        width={iconPixels}
        height={iconPixels}
        viewBox="0 0 24 24"
        fill={isSaved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="heart-svg"
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>

      <style jsx>{`
        .wishlist-heart-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #cbd5e1;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          padding: 0;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .wishlist-heart-btn:hover {
          background: rgba(30, 41, 59, 0.9);
          border-color: rgba(244, 63, 94, 0.5);
          color: #f43f5e;
          transform: scale(1.08);
        }

        .wishlist-heart-btn.saved {
          background: rgba(244, 63, 94, 0.15);
          border-color: rgba(244, 63, 94, 0.45);
          color: #f43f5e;
          box-shadow: 0 4px 16px rgba(244, 63, 94, 0.3);
        }

        .wishlist-heart-btn.pop-anim {
          animation: heart-pop 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }

        .heart-svg {
          transition: transform 0.2s ease;
        }

        @keyframes heart-pop {
          0% {
            transform: scale(1);
          }
          40% {
            transform: scale(1.35) rotate(-12deg);
          }
          75% {
            transform: scale(0.9) rotate(4deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
          }
        }
      `}</style>
    </button>
  );
}
