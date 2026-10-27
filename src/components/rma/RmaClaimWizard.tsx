"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { DefectCategory } from "./types";
import { useToast } from "@/components/ui/toast";

interface RmaClaimWizardProps {
  sealId?: string;
  orderNumber?: string;
  productTitle?: string;
}

export function RmaClaimWizard({
  sealId = "NCA-9X4K-2M7B",
  orderNumber = "NCA-2026-84920",
  productTitle = "Anker Prime 67W GaN Wall Charger (3 Ports)",
}: RmaClaimWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Defect Info
  const [defectCategory, setDefectCategory] = useState<DefectCategory>("DEAD_ON_ARRIVAL");
  const [defectDescription, setDefectDescription] = useState("");

  // Step 2: Proof Uploads
  const [sealPhoto, setSealPhoto] = useState<File | null>(null);
  const [sealPhotoPreview, setSealPhotoPreview] = useState<string | null>(null);

  const [demoVideo, setDemoVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState<number>(0);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  // Step 3: Resolution & Address
  const [preferredResolution, setPreferredResolution] = useState<
    "REPLACEMENT_UNIT" | "STORE_CREDIT_REFUND"
  >("REPLACEMENT_UNIT");
  const [contactPhone, setContactPhone] = useState("+880 1712-345678");
  const [pickupAddress, setPickupAddress] = useState(
    "House #14, Road #5, Flat 4B, Dhanmondi R/A, Dhaka"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);

  const { addToast } = useToast();

  const handleSealPhotoChange = (file: File) => {
    if (!file.type.startsWith("image/")) {
      addToast({
        title: "Invalid File Type",
        description: "Please upload an image file (JPG, PNG, WebP) showing the seal intact.",
        variant: "error",
      });
      return;
    }
    setSealPhoto(file);
    const objectUrl = URL.createObjectURL(file);
    setSealPhotoPreview(objectUrl);
  };

  const handleVideoChange = (file: File) => {
    // 50MB max = 50 * 1024 * 1024 bytes
    const maxSizeBytes = 50 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      addToast({
        title: "File Too Large",
        description: "Video size must not exceed 50MB.",
        variant: "error",
      });
      return;
    }

    setDemoVideo(file);
    setVideoPreview(URL.createObjectURL(file));

    // Simulate direct upload to presigned R2/S3 URL
    setIsUploadingVideo(true);
    setVideoUploadProgress(10);

    const interval = setInterval(() => {
      setVideoUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploadingVideo(false);
          addToast({
            title: "Video Uploaded",
            description: "Unboxing / defect demonstration video uploaded securely.",
            variant: "success",
          });
          return 100;
        }
        return prev + 25;
      });
    }, 200);
  };

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (defectDescription.trim().length < 15) {
      addToast({
        title: "Description Too Short",
        description: "Please provide at least 15 characters describing the defect.",
        variant: "error",
      });
      return;
    }
    setStep(2);
  };

  const handleStep2Next = () => {
    if (!sealPhoto) {
      addToast({
        title: "Seal Photo Required",
        description: "Please upload a clear photo of the physical product showing the Holographic Seal.",
        variant: "error",
      });
      return;
    }

    if (!demoVideo) {
      addToast({
        title: "Defect Video Required",
        description: "Please upload a short unboxing or fault demonstration video.",
        variant: "error",
      });
      return;
    }

    if (isUploadingVideo || videoUploadProgress < 100) {
      addToast({
        title: "Upload in Progress",
        description: "Please wait for the video upload to complete.",
        variant: "info",
      });
      return;
    }

    setStep(3);
  };

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      const generatedTicket = `RMA-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      setTicketId(generatedTicket);
      setIsSubmitting(false);
      setStep(4);
      addToast({
        title: "RMA Claim Submitted",
        description: `Ticket ${generatedTicket} created. Our quality team is reviewing your claim.`,
        variant: "success",
      });
    }, 800);
  };

  return (
    <div className="rma-wizard-container" role="region" aria-label="RMA Claim Wizard">
      {/* SLA Assurance Banner */}
      <aside className="sla-banner">
        <div className="sla-icon">🛡️</div>
        <div className="sla-content">
          <strong>NCAMart RMA Guarantee:</strong> Claims reviewed within 1 business hour. Dhaka doorstep swap within 72 hours.
        </div>
      </aside>

      {/* Main Wizard Card */}
      <div className="wizard-card">
        {/* Step Indicator Header */}
        <div className="wizard-stepper">
          {[
            { num: 1, label: "Defect Description" },
            { num: 2, label: "Proof Uploads" },
            { num: 3, label: "Resolution & Address" },
            { num: 4, label: "Confirmation" },
          ].map((s) => (
            <div
              key={s.num}
              className={`step-item ${step === s.num ? "active" : ""} ${
                step > s.num ? "completed" : ""
              }`}
            >
              <div className="step-circle">{step > s.num ? "✓" : s.num}</div>
              <span className="step-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* STEP 1: DEFECT CHECKLIST */}
        {step === 1 && (
          <form onSubmit={handleStep1Next} className="step-pane" data-testid="rma-step-1">
            <header className="step-header">
              <h2>Step 1: Defect Description &amp; Technical Checklist</h2>
              <p>Identify the specific technical failure experienced with your product.</p>
            </header>

            <div className="product-summary-bar">
              <span className="seal-tag">SEAL ID: {sealId}</span>
              <strong className="product-name">{productTitle}</strong>
              <span className="order-tag">Order: {orderNumber}</span>
            </div>

            <div className="form-group">
              <label className="field-label">Primary Defect Category</label>
              <div className="defect-grid">
                {[
                  { id: "DEAD_ON_ARRIVAL", label: "Dead on Arrival (DOA)", desc: "Product will not power on or function immediately out of the box." },
                  { id: "OVERHEATING", label: "Abnormal Overheating", desc: "Thermal load exceeds standard operating temperature or triggers safety shutdown." },
                  { id: "PORT_LOOSE", label: "Loose Port / Connector", desc: "Type-C, USB-A or terminal port is mechanically loose or disconnects." },
                  { id: "NO_POWER", label: "Power Delivery Failure", desc: "Fails to negotiate PD wattage or charge connected devices." },
                  { id: "SPEC_MISMATCH", label: "Spec Mismatch / Variance", desc: "Output parameters or included attachments differ from manufacturer specification." },
                  { id: "OTHER", label: "Other Technical Anomaly", desc: "Specific circuit, firmware, or hardware behavior described below." },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`defect-card ${defectCategory === item.id ? "active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="defect-cat"
                      value={item.id}
                      checked={defectCategory === item.id}
                      onChange={() => setDefectCategory(item.id as DefectCategory)}
                    />
                    <div className="defect-text">
                      <strong>{item.label}</strong>
                      <span>{item.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="defect-desc" className="field-label">
                Detailed Defect Explanation (Minimum 15 characters)
              </label>
              <textarea
                id="defect-desc"
                rows={4}
                placeholder="Describe what occurred during testing or daily operation (e.g. tested on 65W laptop load, charger shuts off after 2 minutes)..."
                value={defectDescription}
                onChange={(e) => setDefectDescription(e.target.value)}
                required
                data-testid="defect-description-input"
              />
              <span className="char-count">
                {defectDescription.length} characters entered
              </span>
            </div>

            <div className="wizard-actions">
              <Link href="/account/warranty" className="btn btn-secondary">
                Cancel
              </Link>
              <button type="submit" className="btn btn-primary" data-testid="step-1-next-button">
                Continue to Proof Uploads →
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: PROOF UPLOADS (PHOTO & VIDEO) */}
        {step === 2 && (
          <div className="step-pane" data-testid="rma-step-2">
            <header className="step-header">
              <h2>Step 2: Proof Uploads with Drag-and-Drop</h2>
              <p>Upload a clear photo of the intact Holographic Seal and a short demonstration video.</p>
            </header>

            <div className="uploads-grid">
              {/* Seal Photo Upload */}
              <div className="upload-box" data-testid="seal-photo-dropzone">
                <span className="box-label">📸 1. Intact Holographic Seal Photo (Required)</span>
                <p className="box-hint">Must show the Crockford Base32 ID and unpeeled tamper seal.</p>

                {sealPhotoPreview ? (
                  <div className="preview-wrap">
                    <img src={sealPhotoPreview} alt="Seal preview" className="thumb-preview" />
                    <button
                      type="button"
                      className="change-file-btn"
                      onClick={() => {
                        setSealPhoto(null);
                        setSealPhotoPreview(null);
                      }}
                    >
                      Change Photo
                    </button>
                  </div>
                ) : (
                  <label className="dropzone-area">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && handleSealPhotoChange(e.target.files[0])}
                      className="hidden-file-input"
                      data-testid="seal-photo-input"
                    />
                    <span className="upload-icon">📷</span>
                    <strong>Drag and drop seal photo here</strong>
                    <span className="upload-sub">or click to browse from device (JPG, PNG)</span>
                  </label>
                )}
              </div>

              {/* Defect Video Upload */}
              <div className="upload-box" data-testid="video-dropzone">
                <span className="box-label">🎥 2. Unboxing or Fault Video (Required)</span>
                <p className="box-hint">Short video (max 50MB, MP4/MOV/WebM) showing the defect in action.</p>

                {videoPreview ? (
                  <div className="preview-wrap">
                    <div className="video-thumb-container">
                      <video src={videoPreview} controls className="video-player-preview" />
                    </div>

                    {isUploadingVideo && (
                      <div className="upload-progress-container" data-testid="video-progress-bar">
                        <div className="progress-bar-rail">
                          <div
                            className="progress-bar-fill"
                            style={{ width: `${videoUploadProgress}%` }}
                          ></div>
                        </div>
                        <span className="progress-text">Uploading: {videoUploadProgress}%</span>
                      </div>
                    )}

                    <button
                      type="button"
                      className="change-file-btn"
                      onClick={() => {
                        setDemoVideo(null);
                        setVideoPreview(null);
                        setVideoUploadProgress(0);
                      }}
                    >
                      Change Video
                    </button>
                  </div>
                ) : (
                  <label className="dropzone-area">
                    <input
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm"
                      onChange={(e) => e.target.files?.[0] && handleVideoChange(e.target.files[0])}
                      className="hidden-file-input"
                      data-testid="video-input"
                    />
                    <span className="upload-icon">🎬</span>
                    <strong>Drag and drop demonstration video</strong>
                    <span className="upload-sub">Max 50MB • MP4, MOV, or WebM</span>
                  </label>
                )}
              </div>
            </div>

            {/* Verification checklist note */}
            <div className="verification-notice">
              <span>🔒 Direct Upload Security:</span> Files are hashed and stored in tamper-proof encrypted cloud storage to establish an auditable chain of custody.
            </div>

            <div className="wizard-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
                ← Back to Defect
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleStep2Next}
                disabled={!sealPhoto || !demoVideo || isUploadingVideo}
                data-testid="step-2-next-button"
              >
                Continue to Resolution →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PREFERRED RESOLUTION & PICKUP ADDRESS */}
        {step === 3 && (
          <form onSubmit={handleFinalSubmit} className="step-pane" data-testid="rma-step-3">
            <header className="step-header">
              <h2>Step 3: Preferred Resolution &amp; Doorstep Swap Address</h2>
              <p>Choose your desired resolution and verify your Dhaka pickup address.</p>
            </header>

            <div className="form-group">
              <label className="field-label">Preferred Resolution Method</label>
              <div className="resolution-options">
                <label
                  className={`resolution-card ${
                    preferredResolution === "REPLACEMENT_UNIT" ? "active" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="res-opt"
                    value="REPLACEMENT_UNIT"
                    checked={preferredResolution === "REPLACEMENT_UNIT"}
                    onChange={() => setPreferredResolution("REPLACEMENT_UNIT")}
                  />
                  <div className="res-info">
                    <div className="res-title-row">
                      <strong>Option A: Identical Replacement Unit</strong>
                      <span className="recommended-pill">Recommended</span>
                    </div>
                    <p>
                      Our courier will arrive at your doorstep in Dhaka within 72 hours, hand over a brand-new factory-sealed replacement unit with a fresh holographic seal, and collect the defective item on the spot.
                    </p>
                  </div>
                </label>

                <label
                  className={`resolution-card ${
                    preferredResolution === "STORE_CREDIT_REFUND" ? "active" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="res-opt"
                    value="STORE_CREDIT_REFUND"
                    checked={preferredResolution === "STORE_CREDIT_REFUND"}
                    onChange={() => setPreferredResolution("STORE_CREDIT_REFUND")}
                  />
                  <div className="res-info">
                    <strong>Option B: 100% Instant Store Credit Refund</strong>
                    <p>
                      Funds credited instantly to your NCAMart Wallet upon inspection. Usable immediately for any item or cash withdrawal to your bKash/Bank account.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="contact-phone" className="field-label">Rider Contact Phone</label>
                <input
                  id="contact-phone"
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="pickup-address" className="field-label">Doorstep Pickup Address</label>
                <input
                  id="pickup-address"
                  type="text"
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="wizard-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
                ← Back to Uploads
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
                data-testid="submit-claim-button"
              >
                {isSubmitting ? "Submitting Claim..." : "Confirm & Submit RMA Claim"}
              </button>
            </div>
          </form>
        )}

        {/* STEP 4: SUCCESS CONFIRMATION & TICKET */}
        {step === 4 && (
          <div className="step-pane confirmation-pane" data-testid="rma-step-4">
            <div className="success-icon">🎉</div>
            <h2>RMA Claim Successfully Submitted</h2>
            <p className="confirmation-sub">
              Your defect report has been logged in our quality assurance registry.
            </p>

            <div className="ticket-card">
              <span className="ticket-label">OFFICIAL RMA TRACKING TICKET</span>
              <strong className="ticket-code" data-testid="rma-ticket-code">{ticketId}</strong>
              <div className="ticket-sla">
                <span>⚡ Review SLA: Within 1 Business Hour</span>
                <span className="dot">•</span>
                <span>🚚 Dhaka Doorstep Swap: Within 72 Hours</span>
              </div>
            </div>

            <div className="next-steps-list">
              <h3>What Happens Next:</h3>
              <ol>
                <li>Our QC supervisor in Nawabpur reviews your unboxing video and seal photo within 1 hour.</li>
                <li>You will receive an SMS and WhatsApp confirmation with rider dispatch details.</li>
                <li>Keep the physical item ready in its original retail box for doorstep swap.</li>
              </ol>
            </div>

            <div className="wizard-actions center">
              <Link href="/account/warranty" className="btn btn-primary">
                Return to Warranties Portal
              </Link>
              <Link href="/account" className="btn btn-secondary">
                Account Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .rma-wizard-container {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          max-width: 900px;
          margin: 0 auto;
        }

        .sla-banner {
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          border-left: 5px solid #059669;
          border-radius: var(--radius-lg, 0.75rem);
          padding: 1rem 1.25rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.875rem;
          color: #065f46;
        }

        .sla-icon { font-size: 1.25rem; }

        .wizard-card {
          background: var(--color-surface, #ffffff);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius-xl, 1.25rem);
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
        }

        /* Stepper */
        .wizard-stepper {
          display: flex;
          background: var(--color-surface-subtle, #f8fafc);
          border-bottom: 1px solid var(--color-border, #e5e7eb);
          padding: 1.25rem 2rem;
          gap: 1.5rem;
          overflow-x: auto;
        }

        @media (max-width: 640px) {
          .wizard-stepper {
            padding: 1rem;
            gap: 1rem;
          }
        }

        .step-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          opacity: 0.5;
          white-space: nowrap;
        }

        .step-item.active { opacity: 1; }
        .step-item.completed { opacity: 0.9; }

        .step-circle {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--color-surface, #ffffff);
          border: 2px solid var(--color-border, #cbd5e1);
          color: var(--color-text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 800;
        }

        .step-item.active .step-circle {
          background: #059669;
          border-color: #059669;
          color: #ffffff;
        }

        .step-item.completed .step-circle {
          background: #dcfce7;
          border-color: #10b981;
          color: #15803d;
        }

        .step-label {
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        /* Step Pane */
        .step-pane {
          padding: 2.5rem;
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        @media (max-width: 640px) {
          .step-pane { padding: 1.5rem; }
        }

        .step-header h2 {
          font-size: 1.375rem;
          font-weight: 800;
          color: var(--color-text-primary);
          margin-bottom: 0.25rem;
        }

        .step-header p {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }

        .product-summary-bar {
          background: var(--color-surface-subtle, #f8fafc);
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: var(--radius-md, 0.5rem);
          padding: 0.75rem 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          font-size: 0.8125rem;
        }

        .seal-tag { font-family: var(--font-mono, monospace); font-weight: 700; color: #059669; }
        .product-name { color: var(--color-text-primary); }
        .order-tag { color: var(--color-text-secondary); }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .field-label {
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .defect-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 0.75rem;
        }

        .defect-card {
          display: flex;
          align-items: flex-start;
          gap: 0.625rem;
          padding: 0.875rem;
          border: 1px solid var(--color-border, #cbd5e1);
          border-radius: var(--radius-lg, 0.75rem);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .defect-card.active {
          border-color: #059669;
          background: #f0fdf4;
        }

        .defect-text {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .defect-text strong {
          font-size: 0.8125rem;
          color: var(--color-text-primary);
        }

        .defect-text span {
          font-size: 0.6875rem;
          color: var(--color-text-secondary);
          line-height: 1.3;
        }

        textarea, input[type="text"] {
          padding: 0.75rem 1rem;
          border: 1px solid var(--color-border, #cbd5e1);
          border-radius: var(--radius-md, 0.5rem);
          font-size: 0.875rem;
          font-family: inherit;
        }

        .char-count {
          font-size: 0.6875rem;
          color: var(--color-text-secondary);
          text-align: right;
        }

        /* Uploads */
        .uploads-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }

        @media (max-width: 768px) {
          .uploads-grid {
            grid-template-columns: 1fr;
          }
        }

        .upload-box {
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: var(--radius-lg, 0.75rem);
          padding: 1.25rem;
          background: var(--color-surface-subtle, #f8fafc);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .box-label {
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .box-hint {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          margin-bottom: 0.5rem;
        }

        .dropzone-area {
          border: 2px dashed #059669;
          border-radius: var(--radius-md, 0.5rem);
          padding: 2rem 1.5rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.35rem;
          cursor: pointer;
          background: #ffffff;
          transition: background 0.15s ease;
        }

        .dropzone-area:hover { background: #f0fdf4; }
        .upload-icon { font-size: 2rem; margin-bottom: 0.25rem; }
        .upload-sub { font-size: 0.6875rem; color: var(--color-text-secondary); }
        .hidden-file-input { display: none; }

        .preview-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }

        .thumb-preview {
          max-height: 160px;
          border-radius: var(--radius-md, 0.5rem);
          object-fit: contain;
          border: 1px solid var(--color-border);
        }

        .video-thumb-container {
          width: 100%;
          border-radius: var(--radius-md, 0.5rem);
          overflow: hidden;
          background: #000000;
        }

        .video-player-preview {
          width: 100%;
          max-height: 160px;
        }

        .change-file-btn {
          font-size: 0.75rem;
          font-weight: 600;
          color: #dc2626;
          background: transparent;
          border: none;
          cursor: pointer;
          text-decoration: underline;
        }

        .upload-progress-container {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .progress-bar-rail {
          width: 100%;
          height: 6px;
          background: #e2e8f0;
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          background: #10b981;
          transition: width 0.2s ease;
        }

        .progress-text {
          font-size: 0.6875rem;
          font-weight: 700;
          color: #059669;
          text-align: right;
        }

        .verification-notice {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          background: #f8fafc;
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md, 0.5rem);
          border: 1px solid #e2e8f0;
        }

        /* Step 3: Resolution */
        .resolution-options {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .resolution-card {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          padding: 1.25rem;
          border: 1px solid var(--color-border, #cbd5e1);
          border-radius: var(--radius-lg, 0.75rem);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .resolution-card.active {
          border-color: #059669;
          background: #f0fdf4;
        }

        .res-info {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .res-title-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .recommended-pill {
          font-size: 0.625rem;
          font-weight: 800;
          background: #dcfce7;
          color: #15803d;
          padding: 0.15rem 0.5rem;
          border-radius: 9999px;
        }

        .res-info p {
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          line-height: 1.4;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        @media (max-width: 640px) {
          .form-grid { grid-template-columns: 1fr; }
        }

        /* Step 4: Confirmation */
        .confirmation-pane {
          text-align: center;
          align-items: center;
        }

        .success-icon { font-size: 3.5rem; }

        .confirmation-sub {
          font-size: 0.9375rem;
          color: var(--color-text-secondary);
          max-width: 440px;
        }

        .ticket-card {
          background: #f0fdf4;
          border: 2px dashed #10b981;
          border-radius: var(--radius-xl, 1.25rem);
          padding: 1.5rem 2.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          align-items: center;
        }

        .ticket-label {
          font-size: 0.6875rem;
          letter-spacing: 0.08em;
          font-weight: 800;
          color: #059669;
        }

        .ticket-code {
          font-family: var(--font-mono, monospace);
          font-size: 2rem;
          font-weight: 800;
          color: #047857;
        }

        .ticket-sla {
          display: flex;
          gap: 0.5rem;
          font-size: 0.75rem;
          font-weight: 700;
          color: #065f46;
        }

        .next-steps-list {
          text-align: left;
          background: var(--color-surface-subtle, #f8fafc);
          padding: 1.5rem;
          border-radius: var(--radius-lg, 0.75rem);
          border: 1px solid var(--color-border, #e2e8f0);
          max-width: 500px;
          width: 100%;
        }

        .next-steps-list h3 {
          font-size: 0.9375rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }

        .next-steps-list ol {
          padding-left: 1.25rem;
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          line-height: 1.5;
        }

        /* Actions */
        .wizard-actions {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--color-border, #e5e7eb);
        }

        .wizard-actions.center { justify-content: center; }

        .btn {
          padding: 0.625rem 1.25rem;
          border-radius: var(--radius-md, 0.5rem);
          font-size: 0.875rem;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .btn-primary { background: #059669; color: #ffffff; border: none; }
        .btn-primary:hover:not(:disabled) { background: #047857; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .btn-secondary {
          background: transparent;
          color: var(--color-text-primary);
          border: 1px solid var(--color-border, #cbd5e1);
        }
      `}</style>
    </div>
  );
}
