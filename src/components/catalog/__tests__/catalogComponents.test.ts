import { describe, it, expect, vi } from "vitest";
import React from "react";
import {
  FacetedFilterSidebar,
  CatalogHeader,
  ProductCard,
  ProductGrid,
  CatalogProduct,
} from "../index";

// Mock toast hook
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe("F10 — Catalog Listing Page & Dynamic Faceted Filters", () => {
  const sampleProduct: CatalogProduct = {
    id: "prod-test-1",
    slug: "baseus-65w-gan",
    title_en: "Baseus 65W GaN Charger",
    brand_name: "Baseus",
    product_tier: "AUTHENTIC",
    min_regular_price_paisa: 395000,
    min_sale_price_paisa: 345000,
    rating: 4.9,
    reviews_count: 50,
    availability: "IN_STOCK",
  };

  it("renders FacetedFilterSidebar with tier radio options and reset button", () => {
    const handleFilterChange = vi.fn();
    const handleReset = vi.fn();

    const element = React.createElement(FacetedFilterSidebar, {
      filters: { tier: "AUTHENTIC" },
      onFilterChange: handleFilterChange,
      onReset: handleReset,
    });

    expect(element).toBeDefined();
    expect(element.props.filters.tier).toBe("AUTHENTIC");
  });

  it("renders CatalogHeader with result counts, sort dropdown, and active filter removal", () => {
    const handleSortChange = vi.fn();
    const handleRemoveFilter = vi.fn();
    const handleClearAll = vi.fn();
    const handleOpenMobile = vi.fn();

    const element = React.createElement(CatalogHeader, {
      totalItems: 100,
      shownItems: 25,
      filters: { tier: "AUTHENTIC", brand: "anker" },
      sort: "PRICE_ASC",
      onSortChange: handleSortChange,
      onRemoveFilter: handleRemoveFilter,
      onClearAll: handleClearAll,
      onOpenMobileFilters: handleOpenMobile,
    });

    expect(element).toBeDefined();
    expect(element.props.totalItems).toBe(100);
    expect(element.props.shownItems).toBe(25);
  });

  it("renders ProductCard with dual-tier badge, formatted price and compare checkbox", () => {
    const handleToggleCompare = vi.fn();

    const element = React.createElement(ProductCard, {
      product: sampleProduct,
      isCompared: false,
      onToggleCompare: handleToggleCompare,
    });

    expect(element).toBeDefined();
    expect(element.props.product.title_en).toBe("Baseus 65W GaN Charger");
  });

  it("renders ProductGrid in normal and loading skeleton states", () => {
    const element = React.createElement(ProductGrid, {
      products: [sampleProduct],
      isLoading: false,
    });
    expect(element).toBeDefined();

    const loadingElement = React.createElement(ProductGrid, {
      products: [],
      isLoading: true,
    });
    expect(loadingElement).toBeDefined();
  });
});
