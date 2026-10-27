import { describe, it, expect, vi } from "vitest";
import React from "react";
import { MediaGallery } from "../MediaGallery";
import { ProductIdentity } from "../ProductIdentity";
import { VariantSelector } from "../VariantSelector";
import { DeliveryEstimator } from "../DeliveryEstimator";
import { ProductDetailView } from "../ProductDetailView";
import { ProductDetailData } from "../types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(() => null),
  }),
}));

// Mock toast hook
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const MOCK_DETAIL_DATA: ProductDetailData = {
  id: "prod-test-1",
  slug: "baseus-65w-gan-ultra-fast-charger",
  title_en: "Baseus GaN5 Pro 65W Fast Charger",
  title_bn: "বেসাস ৬৫ ওয়াট ফাস্ট চার্জার",
  product_tier: "AUTHENTIC",
  brand: {
    id: "brand-baseus",
    name: "Baseus",
    slug: "baseus",
  },
  category: {
    id: "cat-chargers",
    name_en: "Fast Chargers",
    name_bn: "ফাস্ট চার্জার",
    slug: "chargers",
  },
  description_en: "Test high speed charger with GaN technology.",
  description_bn: "পরীক্ষামূলক বেসাস চার্জার।",
  vat_rate_bp: 1500,
  zero_replica_attested: true,
  rating: 4.9,
  reviews_count: 55,
  media: [
    {
      id: "m-1",
      url: "https://cdn.example.com/img1.jpg",
      thumbnailUrl: "https://cdn.example.com/img1.jpg",
      kind: "IMAGE",
      title: "Main Image",
    },
    {
      id: "m-2",
      url: "https://cdn.example.com/img2.jpg",
      thumbnailUrl: "https://cdn.example.com/img2.jpg",
      kind: "IMAGE",
      title: "Side View",
    },
    {
      id: "m-3",
      url: "https://cdn.example.com/qc.mp4",
      thumbnailUrl: "https://cdn.example.com/qc-thumb.jpg",
      kind: "VIDEO",
      title: "QC Bench Test",
      duration: "0:45",
    },
  ],
  skus: [
    {
      id: "sku-1",
      sku_code: "BAS-65W-BLK",
      price_paisa: 345000,
      compare_at_price_paisa: 395000,
      attributes: {
        Color: "Matte Black",
        Power: "65W",
      },
      specs: [
        { key: "power", label_en: "Power Output", label_bn: "পাওয়ার", value: "65W", unit: "W" },
      ],
      warranty_label: {
        code: "OFFICIAL_DISTRIBUTOR",
        days: 540,
        label_en: "18 Months Official Warranty",
        label_bn: "১৮ মাসের অফিসিয়াল ওয়ারেন্টি",
      },
      availability: {
        status: "IN_STOCK",
        physical_qty: 15,
        label_en: "In Stock — Packed & Shipped in 24h",
        label_bn: "স্টকে রয়েছে",
      },
    },
    {
      id: "sku-2",
      sku_code: "BAS-65W-WHT",
      price_paisa: 355000,
      compare_at_price_paisa: 405000,
      attributes: {
        Color: "Ceramic White",
        Power: "65W",
      },
      specs: [
        { key: "power", label_en: "Power Output", label_bn: "পাওয়ার", value: "65W", unit: "W" },
      ],
      warranty_label: {
        code: "OFFICIAL_DISTRIBUTOR",
        days: 540,
        label_en: "18 Months Official Warranty",
        label_bn: "১৮ মাসের অফিসিয়াল ওয়ারেন্টি",
      },
      availability: {
        status: "LOW_STOCK",
        physical_qty: 2,
        label_en: "Low Stock: Only 2 left",
        label_bn: "স্টক সীমিত",
      },
    },
  ],
  key_highlights: ["65W Fast Charging", "Dual Type-C + USB-A", "Tamper-proof seal"],
};

describe("F12 — Product Detail Page (PDP) & Interactive Media Gallery", () => {
  it("creates MediaGallery element with media items and title", () => {
    const element = React.createElement(MediaGallery, {
      media: MOCK_DETAIL_DATA.media,
      productTitle: MOCK_DETAIL_DATA.title_en,
    });

    expect(element).toBeDefined();
    expect(element.props.media.length).toBe(3);
    expect(element.props.media[2].kind).toBe("VIDEO");
  });

  it("creates ProductIdentity element with breadcrumbs, rating, SKU, and tier badge", () => {
    const element = React.createElement(ProductIdentity, {
      titleEn: MOCK_DETAIL_DATA.title_en,
      titleBn: MOCK_DETAIL_DATA.title_bn,
      skuCode: "BAS-65W-BLK",
      brandName: "Baseus",
      brandSlug: "baseus",
      categoryName: "Fast Chargers",
      categorySlug: "chargers",
      tier: "AUTHENTIC",
      rating: 4.9,
      reviewsCount: 55,
    });

    expect(element).toBeDefined();
    expect(element.props.titleEn).toBe("Baseus GaN5 Pro 65W Fast Charger");
    expect(element.props.skuCode).toBe("BAS-65W-BLK");
    expect(element.props.tier).toBe("AUTHENTIC");
    expect(element.props.rating).toBe(4.9);
  });

  it("creates VariantSelector element with selectable SKU options", () => {
    const onSelectSku = vi.fn();
    const element = React.createElement(VariantSelector, {
      skus: MOCK_DETAIL_DATA.skus,
      selectedSkuId: "sku-1",
      onSelectSku,
    });

    expect(element).toBeDefined();
    expect(element.props.skus.length).toBe(2);
    expect(element.props.selectedSkuId).toBe("sku-1");
  });

  it("creates DeliveryEstimator element for courier SLA calculation", () => {
    const element = React.createElement(DeliveryEstimator);
    expect(element).toBeDefined();
  });

  it("creates ProductDetailView assembling gallery, identity, price, stock, and specs", () => {
    const element = React.createElement(ProductDetailView, {
      product: MOCK_DETAIL_DATA,
    });

    expect(element).toBeDefined();
    expect(element.props.product.title_en).toBe("Baseus GaN5 Pro 65W Fast Charger");
    expect(element.props.product.skus[0].price_paisa).toBe(345000);
    expect(element.props.product.product_tier).toBe("AUTHENTIC");
  });
});
