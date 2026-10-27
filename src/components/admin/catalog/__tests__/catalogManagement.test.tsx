import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { AdminCatalogListView } from "../AdminCatalogListView";
import { ProductEditorWizard } from "../ProductEditorWizard";
import { ToastProvider } from "@/components/ui/toast";
import { MOCK_CATALOG_PRODUCTS } from "../AdminCatalogListView";

describe("F32: Admin Catalog Governance & Multi-Media Manager", () => {
  it("renders AdminCatalogListView with search, filter tabs, products data table, and integer paisa BDT", () => {
    const html = renderToString(
      <ToastProvider>
        <AdminCatalogListView />
      </ToastProvider>
    );

    expect(html).toContain("admin-catalog-view");
    expect(html).toContain("Catalog &amp; SKU Management");
    expect(html).toContain("Inventory Governance");
    expect(html).toContain("+ Add New Product");

    // Search and Tabs
    expect(html).toContain("All");
    expect(html).toContain("5");
    expect(html).toContain("Authentic");
    expect(html).toContain("Budget Smart");
    expect(html).toContain("Review");

    // Table Content
    expect(html).toContain("Anker 735 GaNPrime 65W Fast Charger");
    expect(html).toContain("ANK-735-65W");
    expect(html).toContain("100% Authentic");
    expect(html).toContain("৳3,800.00");
    expect(html).toContain("৳4,850.00");
    expect(html).toContain("margin-pill");
    expect(html).toContain("42");
    expect(html).toContain("in stock");
  });

  it("renders ProductEditorWizard with dual-tier governance selector, pricing margin calculator, and media sequence", () => {
    const sampleProduct = MOCK_CATALOG_PRODUCTS[0];
    const html = renderToString(
      <ToastProvider>
        <ProductEditorWizard initialProduct={sampleProduct} isNew={false} />
      </ToastProvider>
    );

    expect(html).toContain("product-editor-wizard");
    expect(html).toContain("Configure: Anker 735 GaNPrime 65W Fast Charger (3-Port)");

    // Dual-Tier Governance
    expect(html).toContain("Dual-Tier Quality Governance");
    expect(html).toContain("100% Authentic");
    expect(html).toContain("Budget Smart (Tested OEM)");
    expect(html).toContain("Official Importer / Distributor Name");
    expect(html).toContain("Anker Bangladesh Official Distributor");

    // Basic Identity
    expect(html).toContain("ANK-735-65W");
    expect(html).toContain("Chargers &amp; Adapters");

    // Dynamic Specs
    expect(html).toContain("Category Specifications");
    expect(html).toContain("Max Wattage Output");

    // Media Manager
    expect(html).toContain("Multi-Media Sequence &amp; Unboxing Video");
    expect(html).toContain("Primary Hero");

    // Commercial Margin Calculator
    expect(html).toContain("Live Commercial Modeling");
    expect(html).toContain("Wholesale Baseline Cost");
    expect(html).toContain("Retail Selling Price");
    expect(html).toContain("margin-display-pill");
    expect(html).toContain("21.6");
    expect(html).toContain("Commercial margin exceeds target threshold");
  });

  it("renders ProductEditorWizard for a new product SKU in draft state", () => {
    const html = renderToString(
      <ToastProvider>
        <ProductEditorWizard isNew={true} />
      </ToastProvider>
    );

    expect(html).toContain("Create Product SKU");
    expect(html).toContain("Save as Draft");
    expect(html).toContain("Submit for Review");
    expect(html).toContain("Publish SKU");
  });
});
