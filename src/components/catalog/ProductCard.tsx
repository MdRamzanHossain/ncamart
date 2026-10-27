"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatPaisa } from "@/lib/money";
import { AuthenticBadge, BudgetSmartBadge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

export interface CatalogProduct {
  id: string;
  slug: string;
  title_en: string;
  title_bn?: string;
  brand_name?: string | null;
  product_tier: "AUTHENTIC" | "BUDGET_SMART";
  min_regular_price_paisa?: number;
  min_sale_price_paisa: number;
  primary_image_url?: string | null;
  availability?: string;
  rating?: number;
  reviews_count?: number;
  icon?: string;
}

interface ProductCardProps {
  product: CatalogProduct;
  isCompared?: boolean;
  onToggleCompare?: (product: CatalogProduct) => void;
}

export function ProductCard({
  product,
  isCompared = false,
  onToggleCompare,
}: ProductCardProps) {
  const { toast } = useToast();
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  const isAuthentic = product.product_tier === "AUTHENTIC";
  const hasDiscount =
    product.min_regular_price_paisa &&
    product.min_regular_price_paisa > product.min_sale_price_paisa;

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsWishlisted(!isWishlisted);
    toast({
      variant: !isWishlisted ? "success" : "info",
      title: !isWishlisted ? "Added to Wishlist ❤️" : "Removed from Wishlist",
      description: product.title_en,
    });
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAddingToCart(true);

    setTimeout(() => {
      setIsAddingToCart(false);
      toast({
        variant: "success",
        title: "Added to Cart 🛒",
        description: `${product.title_en} (1 Unit)`,
      });
    }, 400);
  };

  return (
    <div
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-xl)",
        padding: "var(--space-md)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        transition: "all var(--duration-fast) var(--ease-spring)",
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
      }}
      className="interactive-scale"
    >
      <div>
        {/* Top Floating Controls: Compare Checkbox & Wishlist Heart */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--space-xs)",
          }}
        >
          {/* Compare Checkbox */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "10px",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              userSelect: "none",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isCompared}
              onChange={() => onToggleCompare && onToggleCompare(product)}
              style={{ width: "13px", height: "13px", cursor: "pointer" }}
            />
            <span>Compare</span>
          </label>

          {/* Wishlist Button */}
          <button
            type="button"
            onClick={handleWishlist}
            aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            style={{
              background: "transparent",
              border: "none",
              color: isWishlisted ? "#f43f5e" : "var(--text-tertiary)",
              cursor: "pointer",
              fontSize: "16px",
              padding: "2px",
              transition: "transform var(--duration-fast) var(--ease-spring)",
              transform: isWishlisted ? "scale(1.25)" : "scale(1)",
            }}
          >
            {isWishlisted ? "♥" : "♡"}
          </button>
        </div>

        {/* Thumbnail Stage */}
        <Link
          href={`/products/${product.slug}`}
          style={{
            textDecoration: "none",
            display: "block",
          }}
        >
          <div
            style={{
              height: "160px",
              borderRadius: "var(--radius-lg)",
              background: isAuthentic
                ? "radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.12) 0%, rgba(18, 24, 38, 0.8) 100%)"
                : "radial-gradient(circle at 50% 50%, rgba(20, 184, 166, 0.12) 0%, rgba(18, 24, 38, 0.8) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "56px",
              marginBottom: "var(--space-md)",
              position: "relative",
            }}
          >
            <span>{product.icon || (isAuthentic ? "⚡" : "🛠️")}</span>

            {/* In-Stock Badge */}
            <span
              style={{
                position: "absolute",
                bottom: "8px",
                left: "8px",
                backgroundColor: "rgba(11, 15, 25, 0.75)",
                backdropFilter: "blur(4px)",
                color: "var(--color-status-success)",
                fontSize: "9px",
                fontWeight: "700",
                padding: "2px 6px",
                borderRadius: "var(--radius-xs)",
              }}
            >
              Ready for 24h Dispatch
            </span>
          </div>

          {/* Tier Badge & Brand */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "6px",
            }}
          >
            {isAuthentic ? <AuthenticBadge size="sm" /> : <BudgetSmartBadge size="sm" />}
            {product.brand_name && (
              <span style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: "600" }}>
                {product.brand_name}
              </span>
            )}
          </div>

          {/* Title */}
          <h3
            style={{
              fontSize: "var(--font-size-sm)",
              fontWeight: "var(--font-weight-bold)",
              color: "var(--text-primary)",
              lineHeight: "1.4",
              margin: "0 0 6px",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              height: "38px",
            }}
          >
            {product.title_en}
          </h3>

          {/* Rating */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "8px" }}>
            <span style={{ color: "var(--tier-authentic-gold)", fontSize: "11px" }}>★</span>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-primary)" }}>
              {(product.rating || 4.8).toFixed(1)}
            </span>
            <span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>
              ({product.reviews_count || 56})
            </span>
          </div>
        </Link>
      </div>

      {/* Pricing & Add to Cart Button */}
      <div
        style={{
          borderTop: "1px solid var(--border-subtle)",
          paddingTop: "var(--space-sm)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-family-mono)",
              fontSize: "var(--font-size-base)",
              fontWeight: "900",
              color: isAuthentic ? "var(--tier-authentic-gold)" : "var(--tier-budget-teal)",
            }}
          >
            ৳{formatPaisa(product.min_sale_price_paisa)}
          </div>
          {hasDiscount && (
            <div
              style={{
                fontFamily: "var(--font-family-mono)",
                fontSize: "11px",
                color: "var(--text-tertiary)",
                textDecoration: "line-through",
              }}
            >
              ৳{formatPaisa(product.min_regular_price_paisa!)}
            </div>
          )}
        </div>

        {/* Quick Add Button */}
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={isAddingToCart}
          style={{
            padding: "8px 14px",
            borderRadius: "var(--radius-full)",
            backgroundColor: "var(--color-brand-primary)",
            color: "#ffffff",
            fontWeight: "700",
            fontSize: "var(--font-size-xs)",
            border: "none",
            cursor: isAddingToCart ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            boxShadow: "0 2px 8px var(--color-brand-primary-glow)",
          }}
          className="interactive-scale"
        >
          <span>{isAddingToCart ? "..." : "+ Cart"}</span>
        </button>
      </div>
    </div>
  );
}
