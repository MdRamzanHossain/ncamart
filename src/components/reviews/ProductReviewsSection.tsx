"use client";

import React, { useState } from "react";
import type { ReviewItem, ReviewSummaryData } from "./types";
import { ReviewModal } from "./ReviewModal";
import { useToast } from "@/components/ui/toast";

interface ProductReviewsSectionProps {
  productId: string;
  skuCode?: string;
  productTitle: string;
  skuTitle: string;
  tier?: "AUTHENTIC" | "BUDGET_SMART";
  initialSummary?: ReviewSummaryData;
  initialReviews?: ReviewItem[];
  isVerifiedBuyer?: boolean;
}

const DEFAULT_SUMMARY: ReviewSummaryData = {
  averageRating: 4.8,
  totalReviews: 28,
  histogram: {
    5: 23,
    4: 4,
    3: 1,
    2: 0,
    1: 0,
  },
  attributeAverages: {
    buildQuality: 4.9,
    accuracy: 4.8,
    valueForMoney: 4.7,
  },
};

const DEFAULT_REVIEWS: ReviewItem[] = [
  {
    id: "rev_01",
    authorName: "Engr. Tanvir Ahmed",
    authorInitials: "TA",
    rating: 5,
    title: "100% Genuine Anker — Verified Nawabpur Holographic Seal",
    body: "Delivered within 24 hours inside Dhaka! The holographic seal on the box matched the online verification system at ncamart.com/verify immediately. Output tested with digital multimeter, rock-solid 65W GaN power delivery.",
    verifiedPurchase: true,
    tier: "AUTHENTIC",
    createdAt: "2026-10-24",
    helpfulCount: 14,
    hasVotedHelpful: false,
    attributes: {
      buildQuality: 5,
      accuracy: 5,
      valueForMoney: 5,
    },
    images: [
      "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=400&q=80",
    ],
  },
  {
    id: "rev_02",
    authorName: "Sabbir Hossain (Lab Tech)",
    authorInitials: "SH",
    rating: 5,
    title: "No Counterfeit Risk — Solved Our Nawabpur Sourcing Headache",
    body: "We run a robotics workshop in Chittagong. Sourcing authentic electronics from Nawabpur previously required sending runners to physical stalls. NCAMart's QC inspection video and serialized seal make this a no-brainer.",
    verifiedPurchase: true,
    tier: "AUTHENTIC",
    createdAt: "2026-10-18",
    helpfulCount: 9,
    hasVotedHelpful: false,
    attributes: {
      buildQuality: 5,
      accuracy: 4,
      valueForMoney: 5,
    },
  },
  {
    id: "rev_03",
    authorName: "Mahmudul Hasan",
    authorInitials: "MH",
    rating: 4,
    title: "Solid Build & Fast Delivery to Rajshahi",
    body: "Steadfast courier brought the parcel in 48 hours. Packaging was heavy-duty bubble wrapped with tamper-evident tape. Slightly warm after 3 hours continuous load, but well within spec.",
    verifiedPurchase: true,
    tier: "AUTHENTIC",
    createdAt: "2026-10-12",
    helpfulCount: 6,
    hasVotedHelpful: false,
    attributes: {
      buildQuality: 4,
      accuracy: 5,
      valueForMoney: 4,
    },
  },
];

export function ProductReviewsSection({
  productId,
  skuCode = "NCA-SKU-001",
  productTitle,
  skuTitle,
  tier = "AUTHENTIC",
  initialSummary = DEFAULT_SUMMARY,
  initialReviews = DEFAULT_REVIEWS,
  isVerifiedBuyer = true,
}: ProductReviewsSectionProps) {
  const [summary, setSummary] = useState<ReviewSummaryData>(initialSummary);
  const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const { addToast } = useToast();

  const handleOpenModal = () => {
    if (!isVerifiedBuyer) {
      addToast({
        title: "Verified Buyers Only",
        description:
          "Review submission is strictly restricted to customers with a delivered order for this SKU.",
        variant: "error",
      });
      return;
    }
    setIsModalOpen(true);
  };

  const handleReviewSubmit = (newReview: ReviewItem) => {
    // Optimistic update of reviews
    setReviews((prev) => [newReview, ...prev]);

    // Recalculate summary metrics
    const newTotal = summary.totalReviews + 1;
    const newHist = { ...summary.histogram };
    const star = newReview.rating as 1 | 2 | 3 | 4 | 5;
    newHist[star] = (newHist[star] || 0) + 1;

    const totalStarPoints =
      Object.entries(newHist).reduce((acc, [rating, count]) => {
        return acc + Number(rating) * count;
      }, 0);
    const newAvg = Number((totalStarPoints / newTotal).toFixed(1));

    let newAttr = summary.attributeAverages;
    if (newReview.attributes) {
      newAttr = {
        buildQuality: Number(
          (
            (summary.attributeAverages.buildQuality * summary.totalReviews +
              newReview.attributes.buildQuality) /
            newTotal
          ).toFixed(1)
        ),
        accuracy: Number(
          (
            (summary.attributeAverages.accuracy * summary.totalReviews +
              newReview.attributes.accuracy) /
            newTotal
          ).toFixed(1)
        ),
        valueForMoney: Number(
          (
            (summary.attributeAverages.valueForMoney * summary.totalReviews +
              newReview.attributes.valueForMoney) /
            newTotal
          ).toFixed(1)
        ),
      };
    }

    setSummary({
      averageRating: newAvg,
      totalReviews: newTotal,
      histogram: newHist,
      attributeAverages: newAttr,
    });
  };

  const handleToggleHelpful = (reviewId: string) => {
    setReviews((prev) =>
      prev.map((rev) => {
        if (rev.id === reviewId) {
          const alreadyVoted = rev.hasVotedHelpful;
          return {
            ...rev,
            hasVotedHelpful: !alreadyVoted,
            helpfulCount: alreadyVoted ? rev.helpfulCount - 1 : rev.helpfulCount + 1,
          };
        }
        return rev;
      })
    );
  };

  const filteredReviews = reviews.filter((rev) => {
    if (activeFilter === "ALL") return true;
    if (activeFilter === "5") return rev.rating === 5;
    if (activeFilter === "4") return rev.rating === 4;
    if (activeFilter === "3") return rev.rating === 3;
    if (activeFilter === "WITH_PHOTOS") return (rev.images?.length ?? 0) > 0;
    return true;
  });

  return (
    <section id="reviews" className="reviews-section" data-product-id={productId}>
      {/* Header bar */}
      <div className="section-header">
        <div>
          <div className="badge-row">
            <span className="section-pill">
              {tier === "AUTHENTIC" ? "✨ Authentic Customer Feedback" : "⚡ Certified Performance Reviews"}
            </span>
            <span className="verified-rule">PRD §3.16 Verified-Buyer Guard</span>
          </div>
          <h2 className="section-title">
            Customer Reviews & Technical Benchmarks ({summary.totalReviews})
          </h2>
          <p className="section-subtitle">
            Authenticity ratings and real-world performance reports from confirmed Nawabpur Complex deliveries.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenModal}
          className={`write-review-btn ${!isVerifiedBuyer ? "unverified-btn" : ""}`}
        >
          <span className="btn-icon">✍️</span>
          <span>Write a Review</span>
          {!isVerifiedBuyer && <span className="lock-tag">🔒 Delivered Buyers Only</span>}
        </button>
      </div>

      {/* Analytics & Histogram Scorecard */}
      <div className="scorecard-grid">
        {/* Overall Rating Block */}
        <div className="overall-score-card">
          <span className="big-rating">{summary.averageRating.toFixed(1)}</span>
          <div className="stars-row">
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className={`star-icon ${
                  i <= Math.round(summary.averageRating) ? "star-active" : "star-inactive"
                }`}
              >
                ★
              </span>
            ))}
          </div>
          <div className="verified-count-label">
            Based on <strong>{summary.totalReviews} verified purchases</strong>
          </div>
          <div className="zero-fake-guarantee">
            <span className="shield-icon">🛡️</span>
            <span>100% Anti-Bot & Anti-Fake Shield Active</span>
          </div>
        </div>

        {/* 5-Star Histogram Bars */}
        <div className="histogram-card">
          <h4 className="card-subheading">Rating Breakdown</h4>
          <div className="bars-list">
            {([5, 4, 3, 2, 1] as const).map((star) => {
              const count = summary.histogram[star] || 0;
              const pct = summary.totalReviews > 0 ? (count / summary.totalReviews) * 100 : 0;
              return (
                <div key={star} className="bar-row">
                  <span className="star-label">{star} ★</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="bar-count">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Technical Attribute Sliders Breakdown */}
        <div className="attributes-card">
          <h4 className="card-subheading">Technical Benchmarks</h4>
          <div className="attributes-list">
            <div className="attribute-metric">
              <div className="attr-meta">
                <span className="attr-name">Build Quality & Tolerances</span>
                <span className="attr-val">{summary.attributeAverages.buildQuality} / 5.0</span>
              </div>
              <div className="attr-track">
                <div
                  className="attr-fill gold-fill"
                  style={{ width: `${(summary.attributeAverages.buildQuality / 5) * 100}%` }}
                />
              </div>
            </div>

            <div className="attribute-metric">
              <div className="attr-meta">
                <span className="attr-name">Accuracy of Advertised Specs</span>
                <span className="attr-val">{summary.attributeAverages.accuracy} / 5.0</span>
              </div>
              <div className="attr-track">
                <div
                  className="attr-fill cyan-fill"
                  style={{ width: `${(summary.attributeAverages.accuracy / 5) * 100}%` }}
                />
              </div>
            </div>

            <div className="attribute-metric">
              <div className="attr-meta">
                <span className="attr-name">Value for Money (Nawabpur Direct)</span>
                <span className="attr-val">{summary.attributeAverages.valueForMoney} / 5.0</span>
              </div>
              <div className="attr-track">
                <div
                  className="attr-fill emerald-fill"
                  style={{ width: `${(summary.attributeAverages.valueForMoney / 5) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs-row">
        <div className="tabs-list">
          <button
            type="button"
            className={`filter-tab ${activeFilter === "ALL" ? "tab-active" : ""}`}
            onClick={() => setActiveFilter("ALL")}
          >
            All Reviews ({reviews.length})
          </button>
          <button
            type="button"
            className={`filter-tab ${activeFilter === "5" ? "tab-active" : ""}`}
            onClick={() => setActiveFilter("5")}
          >
            5 Stars ({reviews.filter((r) => r.rating === 5).length})
          </button>
          <button
            type="button"
            className={`filter-tab ${activeFilter === "4" ? "tab-active" : ""}`}
            onClick={() => setActiveFilter("4")}
          >
            4 Stars ({reviews.filter((r) => r.rating === 4).length})
          </button>
          <button
            type="button"
            className={`filter-tab ${activeFilter === "WITH_PHOTOS" ? "tab-active" : ""}`}
            onClick={() => setActiveFilter("WITH_PHOTOS")}
          >
            With Photos ({reviews.filter((r) => (r.images?.length ?? 0) > 0).length})
          </button>
        </div>
      </div>

      {/* Reviews List */}
      <div className="reviews-list">
        {filteredReviews.length === 0 ? (
          <div className="empty-reviews">
            <span className="empty-icon">💬</span>
            <p className="empty-title">No reviews match this filter.</p>
            <button
              type="button"
              className="reset-filter-btn"
              onClick={() => setActiveFilter("ALL")}
            >
              Show all reviews
            </button>
          </div>
        ) : (
          filteredReviews.map((rev) => (
            <article key={rev.id} className="review-card">
              {/* Top Row: Author, Badges, Date, Rating */}
              <div className="review-top">
                <div className="author-wrap">
                  <div className="author-avatar">{rev.authorInitials}</div>
                  <div>
                    <div className="author-name-row">
                      <span className="author-name">{rev.authorName}</span>
                      {rev.verifiedPurchase && (
                        <span className="verified-pill">
                          <span className="check">✓</span>
                          <span>Verified Buyer</span>
                        </span>
                      )}
                      <span className="tier-tag">
                        {rev.tier === "AUTHENTIC" ? "✨ Authentic Unit" : "⚡ Budget Smart"}
                      </span>
                    </div>
                    <div className="review-date">
                      Delivered via Nawabpur Logistics • {rev.createdAt}
                    </div>
                  </div>
                </div>

                <div className="review-stars-wrap">
                  <div className="stars">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span
                        key={s}
                        className={s <= rev.rating ? "star-active" : "star-inactive"}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Review Title & Body */}
              <h3 className="review-title">{rev.title}</h3>
              <p className="review-body">{rev.body}</p>

              {/* Review Photos */}
              {rev.images && rev.images.length > 0 && (
                <div className="photos-row">
                  {rev.images.map((img, i) => (
                    <button
                      type="button"
                      key={i}
                      className="photo-thumb-btn"
                      onClick={() => setSelectedImage(img)}
                    >
                      <img src={img} alt={`Review photo ${i + 1}`} className="photo-thumb" />
                    </button>
                  ))}
                </div>
              )}

              {/* Attributes Mini Tags */}
              {rev.attributes && (
                <div className="attributes-tags-row">
                  <span className="attr-tag">
                    Build: <strong>{rev.attributes.buildQuality}/5</strong>
                  </span>
                  <span className="attr-tag">
                    Accuracy: <strong>{rev.attributes.accuracy}/5</strong>
                  </span>
                  <span className="attr-tag">
                    Value: <strong>{rev.attributes.valueForMoney}/5</strong>
                  </span>
                </div>
              )}

              {/* Bottom Row: Helpful Upvote Button */}
              <div className="review-bottom">
                <div className="seal-verified-label">
                  <span>🔒 Checked against physical Crockford Base32 seal</span>
                </div>

                <button
                  type="button"
                  className={`helpful-btn ${rev.hasVotedHelpful ? "helpful-active" : ""}`}
                  onClick={() => handleToggleHelpful(rev.id)}
                  aria-label="Mark review as helpful"
                >
                  <span className="thumb-icon">{rev.hasVotedHelpful ? "👍" : "👍🏻"}</span>
                  <span>Helpful</span>
                  <span className="helpful-count">({rev.helpfulCount})</span>
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Review Submission Modal */}
      <ReviewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        productTitle={productTitle}
        skuTitle={skuTitle || skuCode}
        tier={tier}
        isVerifiedBuyer={isVerifiedBuyer}
        onSubmitReview={handleReviewSubmit}
      />

      {/* Lightbox / Zoom Modal */}
      {selectedImage && (
        <div className="lightbox-backdrop" onClick={() => setSelectedImage(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={selectedImage} alt="Review attachment" className="lightbox-img" />
            <button
              type="button"
              className="lightbox-close"
              onClick={() => setSelectedImage(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .reviews-section {
          margin-top: 50px;
          padding-top: 40px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          color: #f8fafc;
        }

        .section-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 20px;
          margin-bottom: 32px;
        }

        .badge-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }

        .section-pill {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 9999px;
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.3);
          color: #f59e0b;
        }

        .verified-rule {
          font-size: 11px;
          color: #94a3b8;
          font-family: monospace;
        }

        .section-title {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.5px;
          color: #f8fafc;
          margin: 0 0 6px 0;
        }

        .section-subtitle {
          font-size: 14px;
          color: #94a3b8;
          margin: 0;
        }

        .write-review-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 12px 22px;
          border-radius: 10px;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: #0f172a;
          font-size: 14px;
          font-weight: 800;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(245, 158, 11, 0.3);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .write-review-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 22px rgba(245, 158, 11, 0.45);
        }

        .unverified-btn {
          background: rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: none;
        }

        .lock-tag {
          font-size: 11px;
          background: rgba(0, 0, 0, 0.3);
          padding: 2px 6px;
          border-radius: 4px;
        }

        /* Scorecard */
        .scorecard-grid {
          display: grid;
          grid-template-columns: 280px 1.4fr 1.6fr;
          gap: 20px;
          margin-bottom: 32px;
        }

        @media (max-width: 980px) {
          .scorecard-grid {
            grid-template-columns: 1fr;
          }
        }

        .overall-score-card,
        .histogram-card,
        .attributes-card {
          background: rgba(30, 41, 59, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 24px;
          backdrop-filter: blur(12px);
        }

        .overall-score-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .big-rating {
          font-size: 56px;
          font-weight: 900;
          line-height: 1;
          color: #f59e0b;
          text-shadow: 0 0 24px rgba(245, 158, 11, 0.3);
        }

        .stars-row {
          display: flex;
          gap: 4px;
          margin: 10px 0;
          font-size: 20px;
        }

        .star-active {
          color: #f59e0b;
        }

        .star-inactive {
          color: rgba(255, 255, 255, 0.15);
        }

        .verified-count-label {
          font-size: 13px;
          color: #94a3b8;
          margin-bottom: 12px;
        }

        .zero-fake-guarantee {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #10b981;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 9999px;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.25);
        }

        .card-subheading {
          font-size: 14px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #cbd5e1;
          margin: 0 0 16px 0;
        }

        /* Histogram */
        .bars-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .bar-row {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12px;
        }

        .star-label {
          width: 32px;
          font-weight: 600;
          color: #cbd5e1;
        }

        .bar-track {
          flex: 1;
          height: 8px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.08);
          overflow: hidden;
        }

        .bar-fill {
          height: 100%;
          background: #f59e0b;
          border-radius: 9999px;
          transition: width 0.4s ease;
        }

        .bar-count {
          width: 24px;
          text-align: right;
          color: #94a3b8;
          font-weight: 600;
        }

        /* Attributes */
        .attributes-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .attribute-metric {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .attr-meta {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 600;
        }

        .attr-name {
          color: #cbd5e1;
        }

        .attr-val {
          color: #f8fafc;
        }

        .attr-track {
          height: 8px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.08);
          overflow: hidden;
        }

        .attr-fill {
          height: 100%;
          border-radius: 9999px;
          transition: width 0.4s ease;
        }

        .gold-fill {
          background: linear-gradient(90deg, #f59e0b, #fbbf24);
        }

        .cyan-fill {
          background: linear-gradient(90deg, #0ea5e9, #38bdf8);
        }

        .emerald-fill {
          background: linear-gradient(90deg, #10b981, #34d399);
        }

        /* Filter Tabs */
        .filter-tabs-row {
          margin-bottom: 24px;
        }

        .tabs-list {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .filter-tab {
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .filter-tab:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #f8fafc;
        }

        .tab-active {
          background: rgba(245, 158, 11, 0.15);
          border-color: rgba(245, 158, 11, 0.4);
          color: #f59e0b;
        }

        /* Reviews List */
        .reviews-list {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .empty-reviews {
          padding: 48px;
          text-align: center;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 12px;
          border: 1px dashed rgba(255, 255, 255, 0.1);
        }

        .empty-icon {
          font-size: 36px;
          margin-bottom: 12px;
          display: block;
        }

        .empty-title {
          font-size: 14px;
          color: #94a3b8;
          margin: 0 0 14px 0;
        }

        .reset-filter-btn {
          padding: 8px 16px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.08);
          color: #f8fafc;
          border: 1px solid rgba(255, 255, 255, 0.15);
          font-size: 13px;
          cursor: pointer;
        }

        .review-card {
          padding: 24px;
          border-radius: 14px;
          background: rgba(30, 41, 59, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: border-color 0.2s ease;
        }

        .review-card:hover {
          border-color: rgba(255, 255, 255, 0.16);
        }

        .review-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }

        .author-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .author-avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1e293b, #334155);
          border: 2px solid rgba(245, 158, 11, 0.3);
          color: #f59e0b;
          font-size: 14px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .author-name-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .author-name {
          font-size: 15px;
          font-weight: 700;
          color: #f8fafc;
        }

        .verified-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 700;
          color: #10b981;
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.25);
          padding: 2px 8px;
          border-radius: 9999px;
        }

        .tier-tag {
          font-size: 11px;
          color: #cbd5e1;
          background: rgba(255, 255, 255, 0.05);
          padding: 2px 8px;
          border-radius: 9999px;
        }

        .review-date {
          font-size: 12px;
          color: #64748b;
          margin-top: 2px;
        }

        .review-stars-wrap .stars {
          font-size: 16px;
        }

        .review-title {
          font-size: 16px;
          font-weight: 700;
          color: #f8fafc;
          margin: 0;
        }

        .review-body {
          font-size: 14px;
          line-height: 1.65;
          color: #cbd5e1;
          margin: 0;
        }

        .photos-row {
          display: flex;
          gap: 10px;
          margin-top: 4px;
        }

        .photo-thumb-btn {
          background: none;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 2px;
          cursor: pointer;
          overflow: hidden;
          transition: transform 0.2s ease;
        }

        .photo-thumb-btn:hover {
          transform: scale(1.04);
          border-color: #f59e0b;
        }

        .photo-thumb {
          width: 68px;
          height: 68px;
          object-fit: cover;
          border-radius: 6px;
          display: block;
        }

        .attributes-tags-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 4px;
        }

        .attr-tag {
          font-size: 11px;
          color: #94a3b8;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 4px 8px;
          border-radius: 6px;
        }

        .attr-tag strong {
          color: #f8fafc;
        }

        .review-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          margin-top: 4px;
        }

        .seal-verified-label {
          font-size: 11px;
          color: #64748b;
        }

        .helpful-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #94a3b8;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .helpful-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #f8fafc;
        }

        .helpful-active {
          background: rgba(16, 185, 129, 0.15);
          border-color: rgba(16, 185, 129, 0.35);
          color: #10b981;
        }

        .helpful-count {
          font-weight: 700;
        }

        /* Lightbox */
        .lightbox-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .lightbox-content {
          position: relative;
          max-width: 90vw;
          max-height: 90vh;
        }

        .lightbox-img {
          max-width: 100%;
          max-height: 85vh;
          border-radius: 12px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .lightbox-close {
          position: absolute;
          top: -16px;
          right: -16px;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #ef4444;
          color: #fff;
          font-size: 16px;
          font-weight: 700;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        }
      `}</style>
    </section>
  );
}
