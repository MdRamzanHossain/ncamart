"use client";

import React, { useState } from "react";
import type { ReviewItem, ReviewAttributeScores } from "./types";
import { useToast } from "@/components/ui/toast";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  productTitle: string;
  skuTitle: string;
  tier: "AUTHENTIC" | "BUDGET_SMART";
  isVerifiedBuyer: boolean;
  onSubmitReview: (newReview: ReviewItem) => void;
}

const RATING_LABELS: Record<number, string> = {
  1: "1 Star — Poor / Defective",
  2: "2 Stars — Below Expectation",
  3: "3 Stars — Acceptable / Standard",
  4: "4 Stars — Very Good / Reliable",
  5: "5 Stars — Flawless Authentic",
};

export function ReviewModal({
  isOpen,
  onClose,
  productTitle,
  skuTitle,
  tier,
  isVerifiedBuyer,
  onSubmitReview,
}: ReviewModalProps) {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [buildQuality, setBuildQuality] = useState<number>(5);
  const [accuracy, setAccuracy] = useState<number>(5);
  const [valueForMoney, setValueForMoney] = useState<number>(5);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { addToast } = useToast();

  if (!isOpen) return null;

  const currentActiveRating = hoverRating !== null ? hoverRating : rating;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).slice(0, 3); // Up to 3 photos
      const previews: string[] = [];

      files.forEach((file) => {
        if (file.type.startsWith("image/")) {
          previews.push(URL.createObjectURL(file));
        }
      });

      setPhotos((prev) => [...prev, ...previews].slice(0, 3));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isVerifiedBuyer) {
      addToast({
        title: "Verified Buyers Only",
        description: "Only customers who received a delivered order for this item may post reviews.",
        variant: "error",
      });
      return;
    }

    if (reviewBody.trim().length < 15) {
      addToast({
        title: "Review Too Short",
        description: "Please share at least 15 characters of detailed feedback.",
        variant: "error",
      });
      return;
    }

    setIsSubmitting(true);

    const attributes: ReviewAttributeScores = {
      buildQuality,
      accuracy,
      valueForMoney,
    };

    const newReview: ReviewItem = {
      id: `rev_${Date.now()}`,
      authorName: "Engr. Tanvir Ahmed",
      authorInitials: "TA",
      rating,
      title: reviewTitle.trim() || RATING_LABELS[rating],
      body: reviewBody.trim(),
      verifiedPurchase: true,
      tier,
      createdAt: new Date().toISOString(),
      helpfulCount: 0,
      images: photos.length > 0 ? photos : undefined,
      attributes,
    };

    setTimeout(() => {
      onSubmitReview(newReview);
      setIsSubmitting(false);
      onClose();

      addToast({
        title: "Review Published!",
        description: "Thank you for helping fellow Nawabpur engineers with your verified feedback.",
        variant: "success",
      });
    }, 400);
  };

  return (
    <div
      className="review-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
    >
      <div className="modal-container">
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 id="review-modal-title">Write a Verified Buyer Review</h2>
            <p className="product-crumb">
              {productTitle} • <span className="sku-name">{skuTitle}</span>
            </p>
          </div>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            aria-label="Close review modal"
          >
            ✕
          </button>
        </div>

        {/* Unverified Buyer Guard Warning */}
        {!isVerifiedBuyer ? (
          <div className="unverified-guard" data-testid="unverified-guard-notice">
            <span className="guard-icon">🔒</span>
            <h3>Verified Purchase Required</h3>
            <p>
              To eliminate fake and bot reviews, NCAMart strictly reserves review submissions for buyers who have received a confirmed <strong>DELIVERED</strong> shipment of this product.
            </p>
            <div className="guard-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Understood / Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="review-form" data-testid="review-form">
            {/* 1. 5-Star Interactive Rating */}
            <div className="form-group rating-group">
              <label className="field-label">Overall Rating</label>
              <div className="stars-row" role="radiogroup" aria-label="Rating stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={rating === star}
                    className={`star-btn ${currentActiveRating >= star ? "filled" : ""}`}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    data-testid={`star-btn-${star}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <span className="rating-desc" data-testid="rating-label">
                {RATING_LABELS[currentActiveRating]}
              </span>
            </div>

            {/* 2. Technical Attribute Sliders */}
            <div className="technical-sliders-section">
              <span className="section-title">Technical Attribute Breakdown (1 to 5)</span>

              <div className="slider-row">
                <div className="slider-label-row">
                  <span>Build Quality &amp; Materials</span>
                  <strong>{buildQuality} / 5</strong>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={buildQuality}
                  onChange={(e) => setBuildQuality(Number(e.target.value))}
                  data-testid="slider-build-quality"
                />
              </div>

              <div className="slider-row">
                <div className="slider-label-row">
                  <span>Accuracy of Advertised Specs</span>
                  <strong>{accuracy} / 5</strong>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={accuracy}
                  onChange={(e) => setAccuracy(Number(e.target.value))}
                  data-testid="slider-accuracy"
                />
              </div>

              <div className="slider-row">
                <div className="slider-label-row">
                  <span>Value for Money &amp; ROI</span>
                  <strong>{valueForMoney} / 5</strong>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={valueForMoney}
                  onChange={(e) => setValueForMoney(Number(e.target.value))}
                  data-testid="slider-value"
                />
              </div>
            </div>

            {/* 3. Review Title */}
            <div className="form-group">
              <label htmlFor="rev-title" className="field-label">Review Headline</label>
              <input
                id="rev-title"
                type="text"
                placeholder="e.g. Exceptional GaN efficiency and cool thermal dissipation"
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
              />
            </div>

            {/* 4. Review Body */}
            <div className="form-group">
              <label htmlFor="rev-body" className="field-label">
                Detailed Feedback (Min 15 Characters)
              </label>
              <textarea
                id="rev-body"
                rows={4}
                placeholder="How has this tool performed on your workbench? Mention charging speeds, durability, port fit, or any specific measurements..."
                value={reviewBody}
                onChange={(e) => setReviewBody(e.target.value)}
                required
                data-testid="review-body-input"
              />
              <span className="char-count">{reviewBody.length} characters</span>
            </div>

            {/* 5. Photos Upload */}
            <div className="form-group">
              <label className="field-label">Upload Bench Photos (Optional, Max 3)</label>
              <div className="photos-row">
                {photos.map((src, i) => (
                  <div key={i} className="photo-preview-box">
                    <img src={src} alt={`Upload ${i + 1}`} />
                    <button
                      type="button"
                      className="photo-del"
                      onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {photos.length < 3 && (
                  <label className="photo-upload-label">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoUpload}
                      className="hidden-file"
                      data-testid="review-photos-input"
                    />
                    <span>📷 Add Photo</span>
                  </label>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
                data-testid="submit-review-btn"
              >
                {isSubmitting ? "Publishing Review..." : "Submit Verified Review"}
              </button>
            </div>
          </form>
        )}
      </div>

      <style jsx>{`
        .review-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1.5rem;
        }

        .modal-container {
          background: var(--color-surface, #ffffff);
          border-radius: var(--radius-xl, 1.25rem);
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 1.5rem;
          border-bottom: 1px solid var(--color-border, #e5e7eb);
          background: var(--color-surface-subtle, #f8fafc);
        }

        .modal-header h2 {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--color-text-primary);
          margin-bottom: 0.25rem;
        }

        .product-crumb {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }

        .sku-name {
          color: #059669;
          font-weight: 600;
        }

        .close-btn {
          background: transparent;
          border: none;
          font-size: 1.25rem;
          cursor: pointer;
          color: var(--color-text-secondary);
        }

        .review-form {
          padding: 1.5rem;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .field-label {
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        /* Star Rating */
        .rating-group {
          align-items: center;
          text-align: center;
          padding: 1rem;
          background: var(--color-surface-subtle, #f8fafc);
          border-radius: var(--radius-lg, 0.75rem);
          border: 1px solid var(--color-border, #e2e8f0);
        }

        .stars-row {
          display: flex;
          gap: 0.5rem;
          margin: 0.5rem 0;
        }

        .star-btn {
          background: transparent;
          border: none;
          font-size: 2.25rem;
          color: #cbd5e1;
          cursor: pointer;
          transition: transform 0.15s ease, color 0.15s ease;
          line-height: 1;
        }

        .star-btn:hover {
          transform: scale(1.2);
        }

        .star-btn.filled {
          color: #f59e0b;
        }

        .rating-desc {
          font-size: 0.8125rem;
          font-weight: 700;
          color: #d97706;
        }

        /* Sliders */
        .technical-sliders-section {
          background: var(--color-surface-subtle, #f8fafc);
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: var(--radius-lg, 0.75rem);
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
        }

        .section-title {
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-text-secondary);
        }

        .slider-row {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .slider-label-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.8125rem;
          color: var(--color-text-primary);
        }

        .slider-label-row strong {
          color: #059669;
          font-family: var(--font-mono, monospace);
        }

        input[type="range"] {
          accent-color: #059669;
          cursor: pointer;
        }

        input[type="text"], textarea {
          padding: 0.625rem 0.875rem;
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

        /* Photos Row */
        .photos-row {
          display: flex;
          gap: 0.75rem;
        }

        .photo-preview-box {
          position: relative;
          width: 70px;
          height: 70px;
          border-radius: var(--radius-md, 0.5rem);
          overflow: hidden;
          border: 1px solid var(--color-border);
        }

        .photo-preview-box img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .photo-del {
          position: absolute;
          top: 2px;
          right: 2px;
          background: rgba(0, 0, 0, 0.6);
          color: #ffffff;
          border: none;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          font-size: 0.625rem;
          cursor: pointer;
        }

        .photo-upload-label {
          width: 70px;
          height: 70px;
          border: 2px dashed #059669;
          border-radius: var(--radius-md, 0.5rem);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.6875rem;
          font-weight: 700;
          color: #059669;
          cursor: pointer;
          text-align: center;
        }

        .hidden-file { display: none; }

        /* Actions */
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }

        .btn {
          padding: 0.625rem 1.25rem;
          border-radius: var(--radius-md, 0.5rem);
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-primary { background: #059669; color: #ffffff; border: none; }
        .btn-primary:hover:not(:disabled) { background: #047857; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .btn-secondary { background: transparent; color: var(--color-text-primary); border: 1px solid var(--color-border, #cbd5e1); }

        /* Guard */
        .unverified-guard {
          padding: 3rem 2rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .guard-icon { font-size: 3rem; }
        .unverified-guard h3 { font-size: 1.25rem; font-weight: 800; color: var(--color-text-primary); }
        .unverified-guard p { font-size: 0.875rem; color: var(--color-text-secondary); max-width: 440px; line-height: 1.5; }
      `}</style>
    </div>
  );
}
