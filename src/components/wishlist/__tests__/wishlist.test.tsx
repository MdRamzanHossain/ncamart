import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { WishlistView } from "../WishlistView";
import { WishlistHeartButton } from "../WishlistHeartButton";
import { ToastProvider } from "@/components/ui/toast";
import type { WishlistItem } from "../types";

const MOCK_ITEMS: WishlistItem[] = [
  {
    id: "wish_test_01",
    productId: "prod_01",
    skuId: "sku_01",
    slug: "anker-735-ganprime-65w",
    title: "Anker 735 GaNPrime 65W Fast Charger",
    category: "Power Electronics",
    tier: "AUTHENTIC",
    regularPricePaisa: 520000,
    currentPricePaisa: 485000,
    originalPricePaisa: 520000,
    image: "/images/anker.jpg",
    availability: "IN_STOCK",
    priceDropAlert: true,
    stockAlert: false,
    addedAt: "2026-10-20",
  },
  {
    id: "wish_test_02",
    productId: "prod_02",
    skuId: "sku_02",
    slug: "ts101-soldering-iron",
    title: "MINIWARE TS101 65W Smart Soldering Iron",
    category: "Soldering & Rework",
    tier: "BUDGET_SMART",
    regularPricePaisa: 780000,
    currentPricePaisa: 780000,
    image: "/images/ts101.jpg",
    availability: "PRE_ORDER",
    priceDropAlert: false,
    stockAlert: true,
    addedAt: "2026-10-18",
  },
];

describe("F26: Customer Wishlist & Price-Drop Notification Alert", () => {
  it("renders WishlistView with header, metrics, item cards, and BDT prices", () => {
    const html = renderToString(
      <ToastProvider>
        <WishlistView initialItems={MOCK_ITEMS} />
      </ToastProvider>
    );

    // Headers & PRD compliance
    expect(html).toContain("Customer Wishlist &amp; Price-Drop Alerts");
    expect(html).toContain("PRD §3.16 &amp; §3.17 Real-Time Price Tracking");
    expect(html).toContain("Move All to Cart");

    // Metrics
    expect(html).toContain("Saved Items");
    expect(html).toContain("Ready for Dispatch");
    expect(html).toContain("Active Auto-Alerts");
    expect(html).toContain("08:00 – 22:00");

    // Item cards
    expect(html).toContain("Anker 735 GaNPrime 65W Fast Charger");
    expect(html).toContain("MINIWARE TS101 65W Smart Soldering Iron");
    expect(html).toContain("Authentic");
    expect(html).toContain("Budget Smart");

    // Availability pills
    expect(html).toContain("In Stock (24h Dispatch)");
    expect(html).toContain("Pre-Order (Direct Import)");

    // Price drop and savings badge
    expect(html).toContain("savings-badge");
    expect(html).toContain("Save");

    // Notification toggles
    expect(html).toContain("Price-Drop Alert");
    expect(html).toContain("Restock / Pre-Order Alert");
    expect(html).toContain("Instant alert on BDT reduction");
  });

  it("renders empty state when wishlist has no items", () => {
    const html = renderToString(
      <ToastProvider>
        <WishlistView initialItems={[]} />
      </ToastProvider>
    );

    expect(html).toContain("Your Wishlist is Empty");
    expect(html).toContain("Browse Authentic Catalog");
    expect(html).toContain("/catalog");
  });

  it("renders WishlistHeartButton in unsaved state", () => {
    const html = renderToString(
      <ToastProvider>
        <WishlistHeartButton
          productId="prod-100"
          productTitle="GaN Charger 100W"
          initialSaved={false}
        />
      </ToastProvider>
    );

    expect(html).toContain("wishlist-heart-btn");
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-label="Add GaN Charger 100W to wishlist"');
  });

  it("renders WishlistHeartButton in saved state", () => {
    const html = renderToString(
      <ToastProvider>
        <WishlistHeartButton
          productId="prod-100"
          productTitle="GaN Charger 100W"
          initialSaved={true}
        />
      </ToastProvider>
    );

    expect(html).toContain("saved");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-label="Remove GaN Charger 100W from wishlist"');
  });
});
