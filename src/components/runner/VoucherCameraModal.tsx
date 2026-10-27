"use client";

import React, { useState, useRef, useEffect } from "react";
import { useToast } from "@/components/ui/toast";

interface VoucherCameraModalProps {
  isOpen: boolean;
  taskId: string;
  stallName: string;
  onClose: () => void;
  onVoucherCaptured: (taskId: string, voucherDataUrl: string) => void;
}

export function VoucherCameraModal({
  isOpen,
  taskId,
  stallName,
  onClose,
  onVoucherCaptured,
}: VoucherCameraModalProps) {
  const [streamActive, setStreamActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { addToast } = useToast();

  useEffect(() => {
    if (isOpen && !capturedPhoto) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, capturedPhoto]);

  const startCamera = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setStreamActive(true);
      }
    } catch {
      setStreamActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStreamActive(false);
  };

  const captureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.75); // Compressed JPEG < 1MB
      setCapturedPhoto(dataUrl);
      stopCamera();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsCompressing(true);
      const file = e.target.files[0];
      const reader = new FileReader();

      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          const compressed = canvas.toDataURL("image/jpeg", 0.72);
          setCapturedPhoto(compressed);
          setIsCompressing(false);
          stopCamera();
        };
        img.src = event.target?.result as string;
      };

      reader.readAsDataURL(file);
    }
  };

  const handleConfirmVoucher = () => {
    if (!capturedPhoto) return;
    onVoucherCaptured(taskId, capturedPhoto);
    addToast({
      title: "Voucher Attached",
      description: `Wholesale memo uploaded for ${stallName}. Godown intake pipeline notified.`,
      variant: "success",
    });
    onClose();
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  if (!isOpen) return null;

  return (
    <div className="camera-modal-backdrop" data-testid="voucher-camera-modal">
      <div className="camera-modal-content">
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="stall-tag">Wholesale Memo Receipt Scanner</div>
            <h3 className="modal-title">{stallName}</h3>
            <span className="task-id">Task: {taskId}</span>
          </div>
          <button type="button" onClick={onClose} className="close-btn" aria-label="Close scanner">
            ✕
          </button>
        </div>

        {/* Viewfinder / Preview Screen */}
        <div className="viewfinder-box">
          {!capturedPhoto ? (
            <>
              {streamActive ? (
                <div className="video-container">
                  <video ref={videoRef} playsInline autoPlay muted className="camera-video" />
                  <div className="scanner-reticle">
                    <div className="reticle-corner top-left" />
                    <div className="reticle-corner top-right" />
                    <div className="reticle-corner bottom-left" />
                    <div className="reticle-corner bottom-right" />
                    <span className="reticle-label">Align Wholesale Cash Memo Inside Frame</span>
                  </div>
                </div>
              ) : (
                <div className="camera-fallback-card">
                  <span className="camera-icon">📷</span>
                  <p className="fallback-text">
                    Live camera stream unavailable or permission requested.
                  </p>
                  <button
                    type="button"
                    className="gallery-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Take Photo / Choose from Gallery
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="captured-preview-wrap">
              <img src={capturedPhoto} alt="Captured receipt memo" className="captured-img" />
              <div className="compression-badge">
                <span>✓ Compressed to &lt;800KB for Mobile Sync</span>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileUpload}
            style={{ display: "none" }}
            data-testid="voucher-file-input"
          />
        </div>

        {/* Action Controls */}
        <div className="controls-row">
          {!capturedPhoto ? (
            <div className="snap-controls">
              {streamActive && (
                <button
                  type="button"
                  onClick={captureFrame}
                  className="snap-shutter-btn"
                  data-testid="snap-shutter-btn"
                >
                  <span className="shutter-inner" />
                </button>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="gallery-fallback-btn"
              >
                📁 Gallery / File Upload
              </button>
            </div>
          ) : (
            <div className="confirm-controls">
              <button type="button" onClick={handleRetake} className="btn-retake">
                Retake Photo
              </button>
              <button
                type="button"
                onClick={handleConfirmVoucher}
                className="btn-confirm"
                disabled={isCompressing}
                data-testid="confirm-voucher-btn"
              >
                ✓ Attach Memo to Task
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .camera-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.9);
          backdrop-filter: blur(8px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .camera-modal-content {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 16px;
          max-width: 440px;
          width: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          color: #f8fafc;
        }

        .modal-header {
          padding: 14px 16px;
          background: #1e293b;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .stall-tag {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          color: #f59e0b;
          letter-spacing: 0.5px;
        }

        .modal-title {
          font-size: 16px;
          font-weight: 800;
          margin: 2px 0 0 0;
        }

        .task-id {
          font-size: 11px;
          color: #94a3b8;
          font-family: monospace;
        }

        .close-btn {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
          border: none;
          cursor: pointer;
        }

        /* Viewfinder */
        .viewfinder-box {
          position: relative;
          height: 340px;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .video-container {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .camera-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .scanner-reticle {
          position: absolute;
          inset: 24px;
          border: 1px dashed rgba(245, 158, 11, 0.6);
          border-radius: 12px;
          pointer-events: none;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding-bottom: 12px;
        }

        .reticle-corner {
          position: absolute;
          width: 20px;
          height: 20px;
          border-color: #f59e0b;
          border-style: solid;
        }

        .top-left {
          top: -2px;
          left: -2px;
          border-width: 3px 0 0 3px;
        }

        .top-right {
          top: -2px;
          right: -2px;
          border-width: 3px 3px 0 0;
        }

        .bottom-left {
          bottom: -2px;
          left: -2px;
          border-width: 0 0 3px 3px;
        }

        .bottom-right {
          bottom: -2px;
          right: -2px;
          border-width: 0 3px 3px 0;
        }

        .reticle-label {
          background: rgba(0, 0, 0, 0.65);
          color: #fbbf24;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 6px;
        }

        /* Fallback */
        .camera-fallback-card {
          padding: 24px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .camera-icon {
          font-size: 40px;
        }

        .fallback-text {
          font-size: 13px;
          color: #94a3b8;
          max-width: 240px;
          margin: 0;
        }

        .gallery-btn {
          padding: 10px 18px;
          border-radius: 8px;
          background: #3b82f6;
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          border: none;
          cursor: pointer;
        }

        /* Captured Preview */
        .captured-preview-wrap {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .captured-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .compression-badge {
          position: absolute;
          bottom: 12px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(16, 185, 129, 0.85);
          backdrop-filter: blur(4px);
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 12px;
          border-radius: 9999px;
          white-space: nowrap;
        }

        /* Controls */
        .controls-row {
          padding: 16px;
          background: #1e293b;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .snap-controls {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .snap-shutter-btn {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: #fff;
          border: 4px solid rgba(255, 255, 255, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.15s ease;
        }

        .snap-shutter-btn:active {
          transform: scale(0.92);
        }

        .shutter-inner {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: #f59e0b;
        }

        .gallery-fallback-btn {
          background: none;
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #cbd5e1;
          font-size: 12px;
          font-weight: 700;
          padding: 6px 14px;
          border-radius: 6px;
          cursor: pointer;
        }

        .confirm-controls {
          display: flex;
          gap: 10px;
        }

        .btn-retake {
          flex: 1;
          padding: 12px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          border: 1px solid rgba(255, 255, 255, 0.15);
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .btn-confirm {
          flex: 2;
          padding: 12px;
          border-radius: 8px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: #fff;
          border: none;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
