"use client";

import React, { useState, useRef, useCallback } from "react";
import { ProductMediaItem } from "./types";
import { Dialog } from "@/components/ui/dialog";

export interface MediaGalleryProps {
  media: ProductMediaItem[];
  productTitle: string;
}

export function MediaGallery({ media, productTitle }: MediaGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });
  const [activeVideoModal, setActiveVideoModal] = useState<ProductMediaItem | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const activeItem = media[selectedIndex] || {
    id: "default",
    url: "/images/placeholder-product.png",
    kind: "IMAGE",
    title: productTitle,
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setMousePosition({ x, y });
  }, []);

  const handleMouseEnter = () => {
    if (activeItem.kind === "IMAGE") {
      setIsZooming(true);
    }
  };

  const handleMouseLeave = () => {
    setIsZooming(false);
  };

  // Touch swipe support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    if (Math.abs(diff) > 40) {
      if (diff > 0 && selectedIndex < media.length - 1) {
        setSelectedIndex((prev) => prev + 1);
      } else if (diff < 0 && selectedIndex > 0) {
        setSelectedIndex((prev) => prev - 1);
      }
    }
    setTouchStart(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
      {/* Main Showcase Stage */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          position: "relative",
          width: "100%",
          paddingTop: "100%", // 1:1 Aspect Ratio
          borderRadius: "16px",
          backgroundColor: "#0d131f",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          overflow: "hidden",
          cursor: activeItem.kind === "IMAGE" ? "crosshair" : "pointer",
          boxShadow: "inset 0 0 40px rgba(0, 0, 0, 0.6)",
        }}
        onClick={() => {
          if (activeItem.kind === "VIDEO") {
            setActiveVideoModal(activeItem);
          }
        }}
      >
        {/* Main Display Element */}
        {activeItem.kind === "IMAGE" ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transformOrigin: `${mousePosition.x}% ${mousePosition.y}%`,
              transform: isZooming ? "scale(2.2)" : "scale(1)",
              transition: isZooming ? "transform 0.05s ease-out" : "transform 0.25s ease-out",
            }}
          >
            {/* Using standard web img with fallback styling */}
            <div
              role="img"
              aria-label={activeItem.title || productTitle}
              style={{
                width: "82%",
                height: "82%",
                backgroundImage: `url(${activeItem.url})`,
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                filter: "drop-shadow(0 15px 25px rgba(0,0,0,0.7))",
              }}
            />
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)",
            }}
          >
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 30px rgba(59, 130, 246, 0.5)",
                marginBottom: "12px",
                transition: "transform 0.2s ease",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#f8fafc" }}>
              {activeItem.title || "Watch QC & Unboxing Inspection"}
            </span>
            <span style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
              Nawabpur Godown Authenticity Check • {activeItem.duration || "0:45"}
            </span>
          </div>
        )}

        {/* Desktop Zoom Overlay Helper */}
        {activeItem.kind === "IMAGE" && !isZooming && (
          <div
            style={{
              position: "absolute",
              bottom: "12px",
              right: "12px",
              padding: "6px 12px",
              borderRadius: "20px",
              backgroundColor: "rgba(15, 23, 42, 0.8)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              fontSize: "12px",
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              pointerEvents: "none",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
            <span>Hover to Magnify 2.2x</span>
          </div>
        )}

        {/* Video Badge on active image if video exists in collection */}
        {activeItem.kind === "VIDEO" && (
          <div
            style={{
              position: "absolute",
              top: "14px",
              left: "14px",
              padding: "4px 10px",
              borderRadius: "6px",
              backgroundColor: "rgba(239, 68, 68, 0.9)",
              color: "white",
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "white" }} />
            QC Video Verified
          </div>
        )}
      </div>

      {/* Thumbnail Navigation Carousel */}
      {media.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: "10px",
            overflowX: "auto",
            paddingBottom: "6px",
            scrollbarWidth: "thin",
          }}
        >
          {media.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={item.id || idx}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                style={{
                  position: "relative",
                  width: "72px",
                  height: "72px",
                  flexShrink: 0,
                  borderRadius: "10px",
                  backgroundColor: "#0d131f",
                  border: isSelected
                    ? "2px solid #3b82f6"
                    : "1px solid rgba(255, 255, 255, 0.1)",
                  padding: "4px",
                  cursor: "pointer",
                  overflow: "hidden",
                  transition: "all 0.2s ease",
                  transform: isSelected ? "scale(1.04)" : "scale(1)",
                  boxShadow: isSelected ? "0 0 12px rgba(59, 130, 246, 0.4)" : "none",
                }}
              >
                {item.kind === "VIDEO" ? (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "6px",
                      backgroundColor: "#1e293b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#3b82f6">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    <span
                      style={{
                        position: "absolute",
                        bottom: "2px",
                        fontSize: "9px",
                        color: "#94a3b8",
                        fontWeight: 600,
                      }}
                    >
                      QC
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      backgroundImage: `url(${item.thumbnailUrl || item.url})`,
                      backgroundSize: "contain",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "center",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* QC & Unboxing Video Modal */}
      {activeVideoModal && (
        <Dialog
          isOpen={true}
          onClose={() => setActiveVideoModal(null)}
          title={activeVideoModal.title || "Nawabpur QC & Unboxing Inspection"}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                width: "100%",
                paddingTop: "56.25%", // 16:9 Aspect Ratio
                position: "relative",
                backgroundColor: "#000",
                borderRadius: "10px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "radial-gradient(circle at center, #1e293b 0%, #000 100%)",
                  padding: "20px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(59, 130, 246, 0.2)",
                    border: "1px solid #3b82f6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "12px",
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="#3b82f6">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#f8fafc" }}>
                  QC Serialized Bench Testing Feed
                </div>
                <p style={{ fontSize: "13px", color: "#94a3b8", maxWidth: "420px", marginTop: "8px" }}>
                  Live oscilloscope & load-tester bench inspection verified at Nawabpur Complex Lab #12.
                  Each physical package is verified for genuine OEM hologram and certified before dispatch.
                </p>
              </div>
            </div>

            <div
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                backgroundColor: "rgba(16, 185, 129, 0.1)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "13px",
                color: "#10b981",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>100% Passed Multi-Stage Load & Thermal Voltage Regulation Inspection</span>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
