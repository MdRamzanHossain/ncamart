import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { ProductReviewsSection } from "../ProductReviewsSection";
import { ReviewModal } from "../ReviewModal";
import { ToastProvider } from "@/components/ui/toast";

describe("F25: Verified-Buyer Reviews & Rating System", () => {
  it("renders ProductReviewsSection with scorecards, ratings, and histogram bars", () => {
    const html = renderToString(
      <ToastProvider>
        <ProductReviewsSection
          productId="prod-test-01"
          skuCode="SKU-ANKER-65W"
          productTitle="Anker 735 GaNPrime 65W Charger"
          skuTitle="Black — UK 3-Pin"
          tier="AUTHENTIC"
          isVerifiedBuyer={true}
        />
      </ToastProvider>
    );

    // Section headers
    expect(html).toContain("Customer Reviews &amp; Technical Benchmarks");
    expect(html).toContain("PRD §3.16 Verified-Buyer Guard");
    expect(html).toContain("Write a Review");

    // Overall metrics
    expect(html).toContain("4.8");
    expect(html).toContain("Based on");
    expect(html).toContain("verified purchases");
    expect(html).toContain("100% Anti-Bot &amp; Anti-Fake Shield Active");

    // Technical attributes
    expect(html).toContain("Build Quality &amp; Tolerances");
    expect(html).toContain("Accuracy of Advertised Specs");
    expect(html).toContain("Value for Money (Nawabpur Direct)");

    // Verified buyer items
    expect(html).toContain("Engr. Tanvir Ahmed");
    expect(html).toContain("Verified Buyer");
    expect(html).toContain("Helpful");
  });

  it("indicates verified buyer lock on write review button when user is unverified", () => {
    const html = renderToString(
      <ToastProvider>
        <ProductReviewsSection
          productId="prod-test-02"
          productTitle="Test Product"
          skuTitle="Test SKU"
          isVerifiedBuyer={false}
        />
      </ToastProvider>
    );

    expect(html).toContain("Delivered Buyers Only");
    expect(html).toContain("unverified-btn");
  });

  it("renders ReviewModal with 5-star rating, attribute sliders, and verified guard", () => {
    const html = renderToString(
      <ToastProvider>
        <ReviewModal
          isOpen={true}
          onClose={() => {}}
          productTitle="Anker 735 GaNPrime 65W Charger"
          skuTitle="Black — UK 3-Pin"
          tier="AUTHENTIC"
          isVerifiedBuyer={true}
          onSubmitReview={() => {}}
        />
      </ToastProvider>
    );

    // Modal headers & verified purchase badge
    expect(html).toContain("Write a Verified Buyer Review");
    expect(html).toContain("Anker 735 GaNPrime 65W Charger");

    // 5-star rating label
    expect(html).toContain("5 Stars — Flawless Authentic");

    // Technical attribute sliders
    expect(html).toContain("Build Quality &amp; Materials");
    expect(html).toContain("Accuracy of Advertised Specs");
    expect(html).toContain("Value for Money &amp; ROI");

    // Form inputs
    expect(html).toContain("Review Headline");
    expect(html).toContain("Detailed Feedback (Min 15 Characters)");
    expect(html).toContain("Upload Bench Photos (Optional, Max 3)");
  });

  it("displays locked message in ReviewModal if unverified user attempts to submit", () => {
    const html = renderToString(
      <ToastProvider>
        <ReviewModal
          isOpen={true}
          onClose={() => {}}
          productTitle="Test Product"
          skuTitle="Test SKU"
          tier="BUDGET_SMART"
          isVerifiedBuyer={false}
          onSubmitReview={() => {}}
        />
      </ToastProvider>
    );

    expect(html).toContain("Verified Purchase Required");
    expect(html).toContain("To eliminate fake and bot reviews, NCAMart strictly reserves review submissions for buyers who have received a confirmed");
  });
});
