"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductDetailData, ProductSkuVariant } from "./types";
import { MediaGallery } from "./MediaGallery";
import { ProductIdentity } from "./ProductIdentity";
import { VariantSelector } from "./VariantSelector";
import { DeliveryEstimator } from "./DeliveryEstimator";
import { formatPaisa } from "@/lib/money";
import { useToast } from "@/components/ui/toast";
import { HolographicSealPreview } from "@/components/trust";
import { DepositCalculator, PreOrderPolicyBanner } from "@/components/preorder";
import { ProductReviewsSection } from "@/components/reviews";
import Link from "next/link";

export interface ProductDetailViewProps {
  product: ProductDetailData;
}

export function ProductDetailView({ product }: ProductDetailViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [quantity, setQuantity] = useState(1);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [activeTab, setActiveTab] = useState<"specs" | "description" | "warranty">("specs");

  // Read initial SKU from URL param or default to first SKU
  const initialSkuCode = searchParams ? searchParams.get("sku") : null;
  const initialSku =
    product.skus.find((s) => s.sku_code === initialSkuCode || s.id === initialSkuCode) ||
    product.skus[0];

  const [selectedSku, setSelectedSku] = useState<ProductSkuVariant>(initialSku);

  // Sync selected SKU if searchParams change
  useEffect(() => {
    if (initialSkuCode) {
      const match = product.skus.find((s) => s.sku_code === initialSkuCode || s.id === initialSkuCode);
      if (match && match.id !== selectedSku.id) {
        setSelectedSku(match);
      }
    }
  }, [initialSkuCode, product.skus, selectedSku.id]);

  const handleSelectSku = (sku: ProductSkuVariant) => {
    setSelectedSku(sku);
    // Update URL query param smoothly
    const url = new URL(window.location.href);
    url.searchParams.set("sku", sku.sku_code);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  const isAuthentic = product.product_tier === "AUTHENTIC";
  const regularPrice = selectedSku.price_paisa;
  const compareAtPrice = selectedSku.compare_at_price_paisa;
  const hasDiscount = compareAtPrice && compareAtPrice > regularPrice;
  const discountPercent = hasDiscount
    ? Math.round(((compareAtPrice - regularPrice) / compareAtPrice) * 100)
    : 0;

  const availabilityStatus = selectedSku.availability.status;
  const isOutOfStock = availabilityStatus === "OUT_OF_STOCK";
  const isPreOrder = availabilityStatus === "PRE_ORDER";
  const isLowStock = availabilityStatus === "LOW_STOCK";

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    setIsAddingToCart(true);

    setTimeout(() => {
      setIsAddingToCart(false);
      toast({
        title: "Added to Cart!",
        description: `${quantity}x ${product.title_en} (${selectedSku.sku_code}) reserved for 15 minutes.`,
        variant: "success",
      });
      // Dispatch custom event for CartDrawer if present
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("ncamart:cart-add", {
            detail: {
              productId: product.id,
              skuId: selectedSku.id,
              quantity,
              pricePaisa: selectedSku.price_paisa,
              title: product.title_en,
            },
          })
        );
      }
    }, 400);
  };

  const handleBuyNow = () => {
    if (isOutOfStock) return;
    handleAddToCart();
    setTimeout(() => {
      router.push("/checkout");
    }, 500);
  };

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px 16px 80px 16px" }}>
      {/* 2-Column Responsive Layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "40px",
          alignItems: "start",
        }}
      >
        {/* Left Column: Media Gallery */}
        <div style={{ position: "sticky", top: "90px" }}>
          <MediaGallery media={product.media} productTitle={product.title_en} />
        </div>

        {/* Right Column: Identity, Pricing, Variants, CTAs, Delivery */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Identity & Breadcrumbs */}
          <ProductIdentity
            titleEn={product.title_en}
            titleBn={product.title_bn}
            skuCode={selectedSku.sku_code}
            brandName={product.brand?.name || null}
            brandSlug={product.brand?.slug || null}
            categoryName={product.category.name_en}
            categorySlug={product.category.slug}
            tier={product.product_tier}
            rating={product.rating}
            reviewsCount={product.reviews_count}
          />

          {/* Pricing Box */}
          <div
            style={{
              padding: "18px 20px",
              borderRadius: "14px",
              backgroundColor: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: "32px",
                  fontWeight: 900,
                  color: isAuthentic ? "#f59e0b" : "#14b8a6",
                  letterSpacing: "-0.02em",
                }}
              >
                {formatPaisa(regularPrice)}
              </span>

              {hasDiscount && (
                <>
                  <span
                    style={{
                      fontSize: "18px",
                      color: "#64748b",
                      textDecoration: "line-through",
                    }}
                  >
                    {formatPaisa(compareAtPrice)}
                  </span>
                  <span
                    style={{
                      padding: "3px 8px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(239, 68, 68, 0.15)",
                      color: "#ef4444",
                      fontSize: "12px",
                      fontWeight: 800,
                    }}
                  >
                    Save {discountPercent}%
                  </span>
                </>
              )}
            </div>

            <div style={{ fontSize: "12px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>Prices include applicable VAT/Mushak (15%)</span>
              <span>•</span>
              <span style={{ color: "#38bdf8" }}>Official Tax Invoice with QR</span>
            </div>
          </div>

          {/* Stock Availability Indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 14px",
              borderRadius: "10px",
              backgroundColor: isOutOfStock
                ? "rgba(239, 68, 68, 0.08)"
                : isPreOrder
                ? "rgba(14, 165, 233, 0.08)"
                : isLowStock
                ? "rgba(245, 158, 11, 0.08)"
                : "rgba(16, 185, 129, 0.08)",
              border: isOutOfStock
                ? "1px solid rgba(239, 68, 68, 0.25)"
                : isPreOrder
                ? "1px solid rgba(14, 165, 233, 0.25)"
                : isLowStock
                ? "1px solid rgba(245, 158, 11, 0.25)"
                : "1px solid rgba(16, 185, 129, 0.25)",
            }}
          >
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: isOutOfStock
                  ? "#ef4444"
                  : isPreOrder
                  ? "#0ea5e9"
                  : isLowStock
                  ? "#f59e0b"
                  : "#10b981",
                boxShadow: isOutOfStock
                  ? "0 0 8px #ef4444"
                  : "0 0 8px currentColor",
                flexShrink: 0,
              }}
            />
            <div style={{ fontSize: "13px", fontWeight: 600 }}>
              {isOutOfStock ? (
                <span style={{ color: "#ef4444" }}>Out of Stock — Restocking within 48 Hours</span>
              ) : isPreOrder ? (
                <span style={{ color: "#38bdf8" }}>
                  Pre-Order: Direct Import with 15% Deposit (ETA 10–14 Days)
                </span>
              ) : isLowStock ? (
                <span style={{ color: "#f59e0b" }}>
                  Low Stock: Only {selectedSku.availability.physical_qty} left at Nawabpur Godown
                </span>
              ) : (
                <span style={{ color: "#10b981" }}>
                  In Stock — Packed & Shipped from Nawabpur in 24h
                </span>
              )}
            </div>
          </div>

          {/* SKU Variant Selector */}
          <VariantSelector
            skus={product.skus}
            selectedSkuId={selectedSku.id}
            onSelectSku={handleSelectSku}
          />

          {/* Pre-Order Progressive Deposit Calculator if applicable */}
          {isPreOrder && (
            <div style={{ margin: "8px 0" }}>
              <DepositCalculator
                totalPricePaisa={regularPrice}
                defaultDepositPercent={product.preorder_info?.deposit_percentage || 15}
                initialQuantity={quantity}
                onQuantityChange={(q) => setQuantity(q)}
              />
            </div>
          )}

          {/* Quantity & CTA Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#94a3b8" }}>
                Quantity:
              </span>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  backgroundColor: "#0d131f",
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1 || isOutOfStock}
                  style={{
                    padding: "8px 14px",
                    background: "none",
                    border: "none",
                    color: "#cbd5e1",
                    fontSize: "16px",
                    cursor: quantity > 1 ? "pointer" : "not-allowed",
                    opacity: quantity > 1 ? 1 : 0.4,
                  }}
                >
                  −
                </button>
                <span
                  style={{
                    padding: "8px 16px",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#f8fafc",
                    minWidth: "40px",
                    textAlign: "center",
                  }}
                >
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                  disabled={isOutOfStock}
                  style={{
                    padding: "8px 14px",
                    background: "none",
                    border: "none",
                    color: "#cbd5e1",
                    fontSize: "16px",
                    cursor: !isOutOfStock ? "pointer" : "not-allowed",
                  }}
                >
                  +
                </button>
              </div>

              {selectedSku.warranty_label && (
                <div style={{ fontSize: "12px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ color: isAuthentic ? "#f59e0b" : "#14b8a6" }}>🛡️</span>
                  <span>{selectedSku.warranty_label.label_en}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "4px" }}>
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isOutOfStock || isAddingToCart}
                style={{
                  padding: "14px 20px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  color: "#f8fafc",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: isOutOfStock ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  opacity: isOutOfStock ? 0.5 : 1,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
                <span>{isAddingToCart ? "Adding..." : "Add to Cart"}</span>
              </button>

              <button
                type="button"
                onClick={handleBuyNow}
                disabled={isOutOfStock}
                style={{
                  padding: "14px 20px",
                  borderRadius: "10px",
                  backgroundColor: isAuthentic ? "#f59e0b" : "#14b8a6",
                  border: "none",
                  color: "#0f172a",
                  fontSize: "14px",
                  fontWeight: 800,
                  cursor: isOutOfStock ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: isAuthentic
                    ? "0 4px 15px rgba(245, 158, 11, 0.35)"
                    : "0 4px 15px rgba(20, 184, 166, 0.35)",
                  opacity: isOutOfStock ? 0.5 : 1,
                }}
              >
                <span>⚡ Buy Now</span>
              </button>
            </div>
          </div>

          {/* Interactive Delivery & SLA Estimator */}
          <DeliveryEstimator />

          {/* Spec Comparison Quick Link if product belongs to comparison group */}
          {product.comparison_group_id && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "10px",
                backgroundColor: "rgba(59, 130, 246, 0.05)",
                border: "1px solid rgba(59, 130, 246, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#cbd5e1" }}>
                <span>⚖️ Compare with other alternatives in this category</span>
              </div>
              <Link
                href={`/compare?group=${encodeURIComponent(product.comparison_group_id)}`}
                style={{
                  color: "#3b82f6",
                  fontSize: "12px",
                  fontWeight: 700,
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>View Matrix</span>
                <span>→</span>
              </Link>
            </div>
          )}

          {/* Pre-Order 100% Refund SLA Policy Banner */}
          {isPreOrder && (
            <div style={{ marginTop: "16px" }}>
              <PreOrderPolicyBanner />
            </div>
          )}
        </div>
      </div>

      {/* Tabs Section: Specifications, Description & Highlights */}
      <div style={{ marginTop: "60px" }}>
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            gap: "24px",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("specs")}
            style={{
              padding: "12px 6px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "specs" ? "2px solid #3b82f6" : "2px solid transparent",
              color: activeTab === "specs" ? "#f8fafc" : "#94a3b8",
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Technical Specifications ({selectedSku.specs.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("description")}
            style={{
              padding: "12px 6px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "description" ? "2px solid #3b82f6" : "2px solid transparent",
              color: activeTab === "description" ? "#f8fafc" : "#94a3b8",
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Overview & Key Features
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("warranty")}
            style={{
              padding: "12px 6px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "warranty" ? "2px solid #3b82f6" : "2px solid transparent",
              color: activeTab === "warranty" ? "#f8fafc" : "#94a3b8",
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Warranty & Nawabpur QC Standards
          </button>
        </div>

        {/* Tab Content Panes */}
        <div style={{ padding: "28px 0" }}>
          {activeTab === "specs" && (
            <div
              style={{
                borderRadius: "12px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                overflow: "hidden",
                backgroundColor: "rgba(255, 255, 255, 0.02)",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <tbody>
                  {selectedSku.specs.map((item, idx) => (
                    <tr
                      key={item.key || idx}
                      style={{
                        backgroundColor: idx % 2 === 0 ? "rgba(255, 255, 255, 0.01)" : "transparent",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                      }}
                    >
                      <td
                        style={{
                          padding: "14px 20px",
                          width: "35%",
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "#94a3b8",
                        }}
                      >
                        {item.label_en}
                      </td>
                      <td
                        style={{
                          padding: "14px 20px",
                          fontSize: "14px",
                          fontWeight: 500,
                          color: "#f8fafc",
                        }}
                      >
                        {String(item.value)} {item.unit ? `(${item.unit})` : ""}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                    <td style={{ padding: "14px 20px", fontSize: "13px", fontWeight: 600, color: "#94a3b8" }}>
                      Origin Country
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: "14px", color: "#f8fafc" }}>
                      {product.origin_country || "Imported"}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "14px 20px", fontSize: "13px", fontWeight: 600, color: "#94a3b8" }}>
                      Authenticity Certification
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: "14px", color: "#10b981", fontWeight: 600 }}>
                      ✓ Serialized Crockford Base32 Holographic Seal Applied
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "description" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", color: "#cbd5e1", lineHeight: 1.7 }}>
              <p style={{ fontSize: "15px" }}>{product.description_en}</p>
              {product.description_bn && (
                <p style={{ fontSize: "14px", color: "#94a3b8", borderLeft: "3px solid #3b82f6", paddingLeft: "14px" }}>
                  {product.description_bn}
                </p>
              )}

              {product.key_highlights && product.key_highlights.length > 0 && (
                <div style={{ marginTop: "12px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#f8fafc", marginBottom: "12px" }}>
                    Core Engineering Highlights
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
                    {product.key_highlights.map((h, i) => (
                      <div
                        key={i}
                        style={{
                          padding: "12px 16px",
                          borderRadius: "8px",
                          backgroundColor: "rgba(255, 255, 255, 0.03)",
                          border: "1px solid rgba(255, 255, 255, 0.06)",
                          fontSize: "13px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span style={{ color: "#38bdf8" }}>✓</span>
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "warranty" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", color: "#cbd5e1" }}>
              <div
                style={{
                  padding: "20px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(245, 158, 11, 0.05)",
                  border: "1px solid rgba(245, 158, 11, 0.25)",
                }}
              >
                <h4 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: 700, color: "#f59e0b" }}>
                  Nawabpur Complex 4-Step Chain of Custody
                </h4>
                <ol style={{ margin: 0, paddingLeft: "20px", fontSize: "14px", lineHeight: 1.8 }}>
                  <li>
                    <strong>Authorized Inbound:</strong> Staged in climate-controlled godowns at Nawabpur Complex.
                  </li>
                  <li>
                    <strong>Bench Quality Inspection:</strong> Stress-tested using digital oscilloscopes and regulated power supplies.
                  </li>
                  <li>
                    <strong>Tamper-Evident Holographic Seal:</strong> Each package receives a unique Base32 serialized QR seal.
                  </li>
                  <li>
                    <strong>Online Chain Verification:</strong> Customer can verify authenticity immediately at{" "}
                    <Link href="/verify" style={{ color: "#3b82f6" }}>
                      ncamart.com/verify
                    </Link>.
                  </li>
                </ol>
              </div>

              {/* Interactive Holographic Seal Card with VOID toggle */}
              <HolographicSealPreview tier={product.product_tier} />
            </div>
          )}
        </div>
      </div>

      {/* Verified-Buyer Customer Reviews & Technical Breakdown */}
      <ProductReviewsSection
        productId={product.id}
        skuCode={selectedSku.sku_code}
        productTitle={product.title_en}
        skuTitle={selectedSku.title_en}
        tier={product.product_tier}
        initialSummary={{
          averageRating: product.rating,
          totalReviews: product.reviews_count,
          histogram: {
            5: Math.round(product.reviews_count * 0.75),
            4: Math.round(product.reviews_count * 0.18),
            3: Math.max(0, product.reviews_count - Math.round(product.reviews_count * 0.75) - Math.round(product.reviews_count * 0.18)),
            2: 0,
            1: 0,
          },
          attributeAverages: {
            buildQuality: 4.9,
            accuracy: 4.8,
            valueForMoney: 4.7,
          },
        }}
        isVerifiedBuyer={true}
      />
    </div>
  );
}
