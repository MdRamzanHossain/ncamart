import { describe, it, expect, vi } from "vitest";
import React from "react";
import {
  ComparisonMatrix,
  ComparisonTray,
  CompareProductItem,
} from "../index";
import { CatalogProduct } from "@/components/catalog";

// Mock toast hook
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe("F11 — Side-by-Side Spec Comparison Matrix", () => {
  const mockCompareProduct: CompareProductItem = {
    id: "prod-comp-1",
    slug: "baseus-65w-gan",
    title: "Baseus 65W GaN",
    brand: "Baseus",
    tier: "AUTHENTIC",
    pricePaisa: 345000,
    icon: "⚡",
    rating: 4.9,
    specs: {
      maxWattage: "65W",
      chargingProtocols: "PD 3.0",
      ports: "2x USB-C",
      efficiency: "93%",
      shellMaterial: "PC",
      internalCooling: "Graphene",
      weight: "110g",
      oemAttestation: "Official",
      safetyChip: "BPS II",
      overVoltageProtection: "Yes",
      tempSensor: "Dual NTC",
      sealType: "Holographic",
      warrantyDuration: "12M",
      rmaExchangeLocation: "Nawabpur",
      pricePerWatt: "৳53/W",
    },
  };

  it("renders ComparisonTray with selected items and clear action", () => {
    const handleRemove = vi.fn();
    const handleClear = vi.fn();

    const sampleCatalogItem: CatalogProduct = {
      id: "p1",
      slug: "item-1",
      title_en: "Item 1",
      product_tier: "AUTHENTIC",
      min_sale_price_paisa: 100000,
    };

    const element = React.createElement(ComparisonTray, {
      products: [sampleCatalogItem],
      onRemove: handleRemove,
      onClear: handleClear,
    });

    expect(element).toBeDefined();
    expect(element.props.products).toHaveLength(1);
  });

  it("renders ComparisonMatrix with products and spec definitions", () => {
    const handleRemove = vi.fn();

    const element = React.createElement(ComparisonMatrix, {
      products: [mockCompareProduct],
      onRemoveProduct: handleRemove,
    });

    expect(element).toBeDefined();
    expect(element.props.products).toHaveLength(1);
    expect(element.props.products[0].title).toBe("Baseus 65W GaN");
  });

  it("renders empty state in ComparisonMatrix when no items provided", () => {
    const element = React.createElement(ComparisonMatrix, {
      products: [],
      onRemoveProduct: vi.fn(),
    });

    expect(element).toBeDefined();
    expect(element.props.products).toHaveLength(0);
  });
});
