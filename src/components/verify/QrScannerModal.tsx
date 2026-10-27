"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatCrockfordInput, isValidCrockfordSeal } from "./CrockfordInputMask";

export interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanResult?: (sealId: string) => void;
}

export function QrScannerModal({
  isOpen,
  onClose,
  onScanResult,
}: QrScannerModalProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [_isScanning, setIsScanning] = useState(false);

  // Initialize and stop camera stream
  useEffect(() => {
    if (!isOpen) {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
      return;
    }

    let activeStream: MediaStream | null = null;

    async function startCamera() {
      try {
        setCameraError(null);
        setIsScanning(true);
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          activeStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
          });
          setStream(activeStream);
          if (videoRef.current) {
            videoRef.current.srcObject = activeStream;
            videoRef.current.play();
          }
        } else {
          setCameraError("Camera device not supported on this browser.");
        }
      } catch (err: unknown) {
        const error = err as Error;
        setCameraError(
          error.name === "NotAllowedError"
            ? "Camera permission denied. Please allow camera access in browser settings or type Seal ID manually."
            : "Unable to access camera: " + error.message
        );
      }
    }

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDetectedCode = (rawPayload: string) => {
    let extractedSeal = rawPayload;
    try {
      if (rawPayload.includes("verify")) {
        const url = new URL(rawPayload);
        extractedSeal = url.searchParams.get("q") || url.searchParams.get("seal") || "";
      }
    } catch {
      // not a full URL, treat as raw seal
    }

    const formatted = formatCrockfordInput(extractedSeal);
    if (isValidCrockfordSeal(formatted)) {
      if (onScanResult) {
        onScanResult(formatted);
      } else {
        router.push(`/verify/${encodeURIComponent(formatted)}`);
      }
      onClose();
    }
  };

  // Quick test simulations for headless/desktop environments
  const handleSimulateScan = (sealId: string) => {
    handleDetectedCode(sealId);
  };

  return (
    <div className="scanner-backdrop" onClick={onClose}>
      <div className="scanner-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="scanner-header">
          <div className="header-info">
            <h3 className="modal-title">Scan Holographic QR Seal</h3>
            <p className="modal-subtitle">Align the QR code within the target frame</p>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close scanner">
            ✕
          </button>
        </div>

        {/* Viewfinder Area */}
        <div className="viewfinder-container">
          {cameraError ? (
            <div className="camera-error-box">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="error-text">{cameraError}</p>
              <p className="error-hint">You can test with one-click sample seals below:</p>
            </div>
          ) : (
            <div className="video-wrapper">
              <video
                ref={videoRef}
                playsInline
                muted
                className="camera-video"
              />

              {/* Viewfinder Target Reticle */}
              <div className="reticle-box">
                <div className="reticle-corner top-left" />
                <div className="reticle-corner top-right" />
                <div className="reticle-corner bottom-left" />
                <div className="reticle-corner bottom-right" />

                {/* Animated Neon Green Laser Scan Line */}
                <div className="laser-line" />
              </div>
            </div>
          )}
        </div>

        {/* Quick Simulation Chips for Testing */}
        <div className="sample-chips-bar">
          <span className="chips-label">Simulate QR Scan:</span>
          <button
            type="button"
            className="chip-btn chip-genuine"
            onClick={() => handleSimulateScan("NCA-9X4K-2M7B")}
          >
            ✓ Genuine Seal (NCA-9X4K-2M7B)
          </button>
          <button
            type="button"
            className="chip-btn chip-void"
            onClick={() => handleSimulateScan("NCA-VOID-7721")}
          >
            ⚠ Tampered VOID (NCA-VOID-7721)
          </button>
        </div>

        <div className="scanner-footer">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Cancel & Enter ID Manually
          </button>
        </div>
      </div>

      <style jsx>{`
        .scanner-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          z-index: 1000;
        }

        .scanner-dialog {
          background: #090e1a;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 1.25rem;
          width: 100%;
          max-width: 480px;
          overflow: hidden;
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.7);
        }

        .scanner-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          background: rgba(15, 23, 42, 0.6);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .modal-title {
          font-size: 1rem;
          font-weight: 700;
          color: #f3f4f6;
          margin: 0;
        }

        .modal-subtitle {
          font-size: 0.75rem;
          color: #9ca3af;
          margin: 0.2rem 0 0;
        }

        .close-btn {
          background: transparent;
          border: none;
          color: #9ca3af;
          font-size: 1.25rem;
          cursor: pointer;
        }

        .viewfinder-container {
          position: relative;
          width: 100%;
          height: 320px;
          background: #000000;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .camera-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .reticle-box {
          position: absolute;
          width: 220px;
          height: 220px;
          pointer-events: none;
        }

        .reticle-corner {
          position: absolute;
          width: 24px;
          height: 24px;
          border-color: #10b981;
          border-style: solid;
        }

        .top-left {
          top: 0;
          left: 0;
          border-width: 3px 0 0 3px;
        }

        .top-right {
          top: 0;
          right: 0;
          border-width: 3px 3px 0 0;
        }

        .bottom-left {
          bottom: 0;
          left: 0;
          border-width: 0 0 3px 3px;
        }

        .bottom-right {
          bottom: 0;
          right: 0;
          border-width: 0 3px 3px 0;
        }

        .laser-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #34d399, transparent);
          box-shadow: 0 0 10px #34d399, 0 0 4px #10b981;
          animation: scanLaser 2s ease-in-out infinite alternate;
        }

        @keyframes scanLaser {
          0% { top: 5%; }
          100% { top: 95%; }
        }

        .camera-error-box {
          padding: 1.5rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }

        .error-text {
          font-size: 0.8125rem;
          color: #fca5a5;
          margin: 0;
          max-width: 320px;
          line-height: 1.4;
        }

        .error-hint {
          font-size: 0.75rem;
          color: #9ca3af;
          margin: 0;
        }

        .sample-chips-bar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.5rem;
          padding: 0.875rem 1.25rem;
          background: rgba(15, 23, 42, 0.4);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .chips-label {
          font-size: 0.725rem;
          color: #9ca3af;
          font-weight: 600;
        }

        .chip-btn {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 9999px;
          padding: 0.3rem 0.65rem;
          font-size: 0.725rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .chip-genuine {
          color: #6ee7b7;
          border-color: rgba(16, 185, 129, 0.3);
        }

        .chip-genuine:hover {
          background: rgba(16, 185, 129, 0.15);
        }

        .chip-void {
          color: #fca5a5;
          border-color: rgba(239, 68, 68, 0.3);
        }

        .chip-void:hover {
          background: rgba(239, 68, 68, 0.15);
        }

        .scanner-footer {
          padding: 0.875rem 1.25rem;
          text-align: center;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .btn-cancel {
          background: transparent;
          border: none;
          color: #9ca3af;
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-cancel:hover {
          color: #ffffff;
        }
      `}</style>
    </div>
  );
}
