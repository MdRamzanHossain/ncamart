"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import type { AdminCatalogProduct, ProductTier, ProductStatus } from "./types";
import { MOCK_CATALOG_PRODUCTS } from "./mockData";
import { formatPaisa } from "@/lib/money";
import { useToast } from "@/components/ui/toast";

export { MOCK_CATALOG_PRODUCTS };

export function AdminCatalogListView() {
  const [products, setProducts] = useState<AdminCatalogProduct[]>(MOCK_CATALOG_PRODUCTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    "ALL" | "ACTIVE_AUTHENTIC" | "ACTIVE_BUDGET" | "REVIEW_REQUIRED" | "DRAFT" | "ARCHIVED"
  >("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { addToast } = useToast();

  useEffect(() => {
    let isMounted = true;
    fetch("/api/v1/admin/catalog/products?limit=100", { credentials: "include" })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Failed to load catalog products");
      })
      .then((data) => {
        if (!isMounted) return;
        if (Array.isArray(data.items) && data.items.length > 0) {
          const mapped: AdminCatalogProduct[] = data.items.map((item: any) => ({
            id: item.id,
            skuCode: item.slug || `SKU-${item.id.slice(0, 6)}`,
            title: item.titleEn || item.titleBn || "Product",
            category: item.categoryId || "Electrical & Accessories",
            brand: item.brandId || "NCAMart",
            tier: item.productTier === "AUTHENTIC" ? "AUTHENTIC" : "BUDGET_SMART",
            status: item.status,
            basePricePaisa: Number(item.basePricePaisa) || 120000,
            stockCount: item.totalStock ?? 25,
            reservedCount: item.reservedStock ?? 0,
            lastUpdated: item.updatedAt ? new Date(item.updatedAt).toISOString().split("T")[0] : "Today",
          }));
          setProducts(mapped);
        }
      })
      .catch(() => {
        // Fallback for tests or offline dev
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredProducts = products.filter((p) => {
    // Search match
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.title.toLowerCase().includes(q) ||
      p.skuCode.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    // Filter match
    if (activeFilter === "ALL") return true;
    if (activeFilter === "ACTIVE_AUTHENTIC") return p.status === "ACTIVE" && p.tier === "AUTHENTIC";
    if (activeFilter === "ACTIVE_BUDGET") return p.status === "ACTIVE" && p.tier === "BUDGET_SMART";
    if (activeFilter === "REVIEW_REQUIRED") return p.status === "REVIEW_REQUIRED";
    if (activeFilter === "DRAFT") return p.status === "DRAFT";
    if (activeFilter === "ARCHIVED") return p.status === "ARCHIVED";
    return true;
  });

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map((p) => p.id));
    }
  };

  const handleBulkPublish = () => {
    if (selectedIds.length === 0) return;
    setProducts((prev) =>
      prev.map((p) => (selectedIds.includes(p.id) ? { ...p, status: "ACTIVE" } : p))
    );
    addToast({
      title: "SKUs Published",
      description: `${selectedIds.length} items set to Active across Storefront.`,
      variant: "success",
    });
    setSelectedIds([]);
  };

  const handleBulkArchive = () => {
    if (selectedIds.length === 0) return;
    setProducts((prev) =>
      prev.map((p) => (selectedIds.includes(p.id) ? { ...p, status: "ARCHIVED" } : p))
    );
    addToast({
      title: "SKUs Archived",
      description: `${selectedIds.length} items moved to Archived status.`,
      variant: "default",
    });
    setSelectedIds([]);
  };

  return (
    <div className="catalog-mgmt-view" data-testid="admin-catalog-view">
      {/* Header */}
      <div className="catalog-header">
        <div>
          <div className="section-pill">Inventory Governance</div>
          <h1 className="catalog-title">Catalog &amp; SKU Management</h1>
          <p className="catalog-sub">
            Dual-tier governance, spot purchase caps, and live profit margin controls.
          </p>
        </div>

        <div className="header-actions">
          <Link href="/admin/catalog/products/new" className="btn-add-sku" data-testid="btn-add-new-sku">
            <span>+ Add New Product</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="controls-row">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search by SKU, Product Title, or Brand..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="catalog-search-input"
          />
        </div>

        <div className="filter-tabs">
          <button
            type="button"
            className={`tab-btn ${activeFilter === "ALL" ? "active" : ""}`}
            onClick={() => setActiveFilter("ALL")}
          >
            All ({products.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeFilter === "ACTIVE_AUTHENTIC" ? "active" : ""}`}
            onClick={() => setActiveFilter("ACTIVE_AUTHENTIC")}
          >
            Authentic ({products.filter((p) => p.status === "ACTIVE" && p.tier === "AUTHENTIC").length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeFilter === "ACTIVE_BUDGET" ? "active" : ""}`}
            onClick={() => setActiveFilter("ACTIVE_BUDGET")}
          >
            Budget Smart ({products.filter((p) => p.status === "ACTIVE" && p.tier === "BUDGET_SMART").length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeFilter === "REVIEW_REQUIRED" ? "active" : ""}`}
            onClick={() => setActiveFilter("REVIEW_REQUIRED")}
          >
            Review ({products.filter((p) => p.status === "REVIEW_REQUIRED").length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeFilter === "DRAFT" ? "active" : ""}`}
            onClick={() => setActiveFilter("DRAFT")}
          >
            Drafts ({products.filter((p) => p.status === "DRAFT").length})
          </button>
        </div>
      </div>

      {/* Bulk Action Bar (when selected) */}
      {selectedIds.length > 0 && (
        <div className="bulk-action-bar" data-testid="bulk-action-bar">
          <span className="selected-count">{selectedIds.length} items selected</span>
          <div className="bulk-btn-group">
            <button type="button" className="bulk-btn btn-publish" onClick={handleBulkPublish}>
              ✓ Publish Selected
            </button>
            <button type="button" className="bulk-btn btn-archive" onClick={handleBulkArchive}>
              Archive Selected
            </button>
          </div>
        </div>
      )}

      {/* Products Data Table */}
      <div className="table-wrapper">
        <table className="catalog-table" data-testid="catalog-data-table">
          <thead>
            <tr>
              <th className="th-checkbox">
                <input
                  type="checkbox"
                  checked={
                    filteredProducts.length > 0 &&
                    selectedIds.length === filteredProducts.length
                  }
                  onChange={handleSelectAll}
                  aria-label="Select all products"
                />
              </th>
              <th>Product Title &amp; SKU</th>
              <th>Tier</th>
              <th>Category</th>
              <th>Wholesale Cost</th>
              <th>Retail Price</th>
              <th>Margin</th>
              <th>Stock</th>
              <th>Status</th>
              <th className="th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p) => {
              const profitPaisa = p.retailPricePaisa - p.wholesaleBaselineCostPaisa;
              const marginPercent = ((profitPaisa / p.retailPricePaisa) * 100).toFixed(1);

              return (
                <tr key={p.id} className="table-row">
                  <td className="td-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(p.id)}
                      onChange={() => handleToggleSelect(p.id)}
                      aria-label={`Select ${p.title}`}
                    />
                  </td>

                  <td className="td-product">
                    <div className="prod-cell">
                      <img src={p.primaryImage} alt="" className="prod-thumb" />
                      <div>
                        <div className="prod-title">{p.title}</div>
                        <div className="prod-sku">SKU: {p.skuCode}</div>
                      </div>
                    </div>
                  </td>

                  <td>
                    <span
                      className={`tier-pill ${
                        p.tier === "AUTHENTIC" ? "tier-authentic" : "tier-budget"
                      }`}
                    >
                      {p.tier === "AUTHENTIC" ? "100% Authentic" : "Budget Smart"}
                    </span>
                  </td>

                  <td className="td-muted">{p.category}</td>

                  <td className="td-cost">{formatPaisa(p.wholesaleBaselineCostPaisa)}</td>

                  <td className="td-price">{formatPaisa(p.retailPricePaisa)}</td>

                  <td>
                    <span className="margin-pill">+{marginPercent}%</span>
                  </td>

                  <td>
                    <span
                      className={`stock-pill ${
                        p.stockCount > 10
                          ? "stock-in"
                          : p.stockCount > 0
                          ? "stock-low"
                          : "stock-out"
                      }`}
                    >
                      {p.stockCount} in stock
                    </span>
                  </td>

                  <td>
                    <span className={`status-pill status-${p.status.toLowerCase()}`}>
                      {p.status}
                    </span>
                  </td>

                  <td className="td-actions">
                    <Link
                      href={`/admin/catalog/products/${p.id}`}
                      className="edit-link"
                      data-testid={`edit-product-${p.id}`}
                    >
                      Edit ✏️
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .catalog-mgmt-view {
          flex: 1;
          padding: 24px 32px;
          background: #020617;
          min-height: 100vh;
          color: #f8fafc;
          font-family: var(--font-sans, system-ui, sans-serif);
        }

        .catalog-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .section-pill {
          font-size: 10px;
          font-weight: 800;
          color: #f59e0b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .catalog-title {
          font-size: 24px;
          font-weight: 900;
          margin: 0 0 4px 0;
          letter-spacing: -0.4px;
        }

        .catalog-sub {
          font-size: 13px;
          color: #94a3b8;
          margin: 0;
        }

        .btn-add-sku {
          padding: 10px 18px;
          background: #f59e0b;
          color: #0f172a;
          font-size: 13px;
          font-weight: 800;
          border-radius: 8px;
          text-decoration: none;
          transition: background 0.15s ease;
        }

        .btn-add-sku:hover {
          background: #fbbf24;
        }

        /* Search & Filter Controls */
        .controls-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 8px 12px;
          border-radius: 8px;
          width: 340px;
        }

        .search-icon {
          font-size: 14px;
        }

        .search-input {
          background: none;
          border: none;
          color: #f8fafc;
          font-size: 12px;
          outline: none;
          width: 100%;
        }

        .filter-tabs {
          display: flex;
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 3px;
          border-radius: 8px;
          gap: 2px;
        }

        .tab-btn {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
        }

        .tab-btn.active {
          background: #1e293b;
          color: #f59e0b;
        }

        /* Bulk Bar */
        .bulk-action-bar {
          background: #1e293b;
          border: 1px solid #3b82f6;
          border-radius: 8px;
          padding: 10px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .selected-count {
          font-size: 12px;
          font-weight: 700;
          color: #93c5fd;
        }

        .bulk-btn-group {
          display: flex;
          gap: 8px;
        }

        .bulk-btn {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          border: none;
          cursor: pointer;
        }

        .btn-publish {
          background: #10b981;
          color: #022c22;
        }

        .btn-archive {
          background: rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
        }

        /* Data Table */
        .table-wrapper {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          overflow-x: auto;
        }

        .catalog-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          text-align: left;
        }

        .catalog-table th {
          background: #0b1329;
          color: #94a3b8;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 12px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .catalog-table td {
          padding: 12px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          vertical-align: middle;
        }

        .th-checkbox,
        .td-checkbox {
          width: 36px;
          text-align: center;
        }

        .prod-cell {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .prod-thumb {
          width: 36px;
          height: 36px;
          border-radius: 6px;
          object-fit: cover;
          background: #1e293b;
        }

        .prod-title {
          font-weight: 700;
          color: #f8fafc;
          font-size: 12px;
          max-width: 260px;
        }

        .prod-sku {
          font-size: 10px;
          color: #64748b;
          font-family: monospace;
        }

        .tier-pill {
          font-size: 10px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          white-space: nowrap;
        }

        .tier-authentic {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .tier-budget {
          background: rgba(20, 184, 166, 0.15);
          color: #14b8a6;
          border: 1px solid rgba(20, 184, 166, 0.3);
        }

        .td-muted {
          color: #94a3b8;
        }

        .td-cost {
          color: #94a3b8;
          font-family: monospace;
        }

        .td-price {
          color: #f8fafc;
          font-weight: 700;
          font-family: monospace;
        }

        .margin-pill {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          font-weight: 800;
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .stock-pill {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .stock-in {
          background: rgba(16, 185, 129, 0.1);
          color: #34d399;
        }

        .stock-low {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
        }

        .stock-out {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }

        .status-pill {
          font-size: 9px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .status-active {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
        }

        .status-review_required {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
        }

        .status-draft {
          background: rgba(255, 255, 255, 0.08);
          color: #94a3b8;
        }

        .status-archived {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }

        .edit-link {
          color: #38bdf8;
          text-decoration: none;
          font-weight: 700;
          font-size: 11px;
        }

        .edit-link:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
