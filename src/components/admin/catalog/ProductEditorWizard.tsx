"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { AdminCatalogProduct, ProductTier, ProductStatus, MediaUploadItem } from "./types";
import { formatPaisa } from "@/lib/money";
import { useToast } from "@/components/ui/toast";

const CATEGORY_SPECS: Record<string, { key: string; label: string; placeholder: string; unit?: string }[]> = {
  "Chargers & Adapters": [
    { key: "Wattage", label: "Max Wattage Output", placeholder: "e.g. 65W / 140W", unit: "Watts" },
    { key: "Ports", label: "Port Configuration", placeholder: "e.g. 2x USB-C + 1x USB-A" },
    { key: "FastChargeProtocol", label: "Fast Charge Protocol", placeholder: "e.g. PD 3.1, QC 4.0+, PPS" },
    { key: "GaNGeneration", label: "GaN Semiconductor Gen", placeholder: "e.g. GaNPrime 3rd Gen" },
  ],
  "Cables & Interconnects": [
    { key: "Length", label: "Cable Length", placeholder: "e.g. 1.2m, 2.0m", unit: "Meters" },
    { key: "WattageRating", label: "Power Delivery Rating", placeholder: "e.g. 100W, 240W EPR", unit: "Watts" },
    { key: "DataTransferSpeed", label: "Data Transfer Speed", placeholder: "e.g. 480Mbps, 40Gbps USB4" },
    { key: "EMarkerChip", label: "E-Marker IC Model", placeholder: "e.g. Hynetek HUSB332D" },
  ],
  "Precision Soldering Tools": [
    { key: "TempRange", label: "Temperature Range", placeholder: "e.g. 50°C - 400°C" },
    { key: "TipCompatibility", label: "Tip Model Standard", placeholder: "e.g. TS-B2, TS-BC2, T12" },
    { key: "PowerInput", label: "Operating Input Voltage", placeholder: "e.g. DC 9-24V / USB-PD 65W" },
  ],
  "Components & Switches": [
    { key: "SwitchType", label: "Switch Mechanism", placeholder: "e.g. Linear, Tactile, Clicky" },
    { key: "ActuationForce", label: "Actuation Force", placeholder: "e.g. 45g, 50g", unit: "Grams" },
    { key: "LifespanClicks", label: "Rated Cycle Lifespan", placeholder: "e.g. 80 Million Clicks" },
  ],
};

const DEFAULT_CATEGORIES = Object.keys(CATEGORY_SPECS);

interface ProductEditorWizardProps {
  initialProduct?: AdminCatalogProduct;
  isNew?: boolean;
}

export function ProductEditorWizard({ initialProduct, isNew = false }: ProductEditorWizardProps) {
  const { addToast } = useToast();

  const [tier, setTier] = useState<ProductTier>(initialProduct?.tier || "AUTHENTIC");
  const [title, setTitle] = useState(initialProduct?.title || "");
  const [skuCode, setSkuCode] = useState(initialProduct?.skuCode || "");
  const [brand, setBrand] = useState(initialProduct?.brand || "");
  const [category, setCategory] = useState(initialProduct?.category || "Chargers & Adapters");
  const [status, setStatus] = useState<ProductStatus>(initialProduct?.status || "DRAFT");

  // Pricing (stored as integer paisa, edited as BDT)
  const [retailBdt, setRetailBdt] = useState(
    initialProduct ? (initialProduct.retailPricePaisa / 100).toString() : "4850"
  );
  const [wholesaleBdt, setWholesaleBdt] = useState(
    initialProduct ? (initialProduct.wholesaleBaselineCostPaisa / 100).toString() : "3800"
  );
  const [maxSpotBdt, setMaxSpotBdt] = useState(
    initialProduct ? (initialProduct.maxAllowedSpotPricePaisa / 100).toString() : "4100"
  );

  // Tier governance specific fields
  const [distributorName, setDistributorName] = useState(initialProduct?.distributorName || "");
  const [distributorCert, setDistributorCert] = useState(
    initialProduct?.distributorCertificateUrl || "https://ncamart.com/docs/distributor-cert.pdf"
  );
  const [oemReport, setOemReport] = useState(
    initialProduct?.oemTestReportUrl || "https://ncamart.com/docs/oem-lab-report.pdf"
  );

  // Dynamic Specs
  const [specs, setSpecs] = useState<Record<string, string>>(initialProduct?.specs || {});

  // Media items with drag & drop reorder simulation
  const [mediaList, setMediaList] = useState<MediaUploadItem[]>([
    {
      id: "media-01",
      name: "Front Hero Angle",
      url: initialProduct?.primaryImage || "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=400&q=80",
      type: "IMAGE",
      isPrimary: true,
    },
    {
      id: "media-02",
      name: "Ports & GaN Texture Detail",
      url: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=400&q=80",
      type: "IMAGE",
    },
    {
      id: "media-03",
      name: "Official Nawabpur Godown Unboxing Clip",
      url: "https://ncamart.com/videos/unboxing-sample.mp4",
      type: "VIDEO",
    },
  ]);

  // Derived Margin calculations
  const retailPaisa = Math.round((parseFloat(retailBdt) || 0) * 100);
  const wholesalePaisa = Math.round((parseFloat(wholesaleBdt) || 0) * 100);
  const profitPaisa = retailPaisa - wholesalePaisa;
  const marginPercent = retailPaisa > 0 ? ((profitPaisa / retailPaisa) * 100).toFixed(1) : "0.0";
  const isHealthyMargin = parseFloat(marginPercent) >= 10.0;

  const handleSpecChange = (key: string, value: string) => {
    setSpecs((prev) => ({ ...prev, [key]: value }));
  };

  // Media Reorder
  const moveMedia = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= mediaList.length) return;
    const updated = [...mediaList];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    // Mark first item as primary
    const reordered = updated.map((m, idx) => ({ ...m, isPrimary: idx === 0 }));
    setMediaList(reordered);
    addToast({
      title: "Thumbnail Order Updated",
      description: `Primary image set to "${reordered[0].name}".`,
      variant: "default",
    });
  };

  const handleSave = (targetStatus: ProductStatus) => {
    // Validation
    if (!title.trim() || !skuCode.trim()) {
      addToast({
        title: "Validation Error",
        description: "Product Title and SKU Code are mandatory fields.",
        variant: "destructive",
      });
      return;
    }

    if (tier === "AUTHENTIC" && !distributorName.trim()) {
      addToast({
        title: "Authentic Tier Requirement",
        description: "100% Authentic tier requires verified Official Distributor Name.",
        variant: "destructive",
      });
      return;
    }

    if (wholesalePaisa >= retailPaisa) {
      addToast({
        title: "Pricing Error",
        description: "Retail selling price must exceed wholesale baseline cost.",
        variant: "destructive",
      });
      return;
    }

    setStatus(targetStatus);
    addToast({
      title: targetStatus === "ACTIVE" ? "Product SKU Published!" : "Draft Saved",
      description: `SKU ${skuCode} (${tier}) updated successfully.`,
      variant: "success",
    });
  };

  const currentCategorySpecs = CATEGORY_SPECS[category] || [];

  return (
    <div className="product-wizard-view" data-testid="product-editor-wizard">
      {/* Top Header & Breadcrumbs */}
      <div className="wizard-header">
        <div>
          <div className="crumb-row">
            <Link href="/admin/catalog" className="back-link">
              ← Back to Catalog
            </Link>
            <span className="sep">/</span>
            <span className="crumb-current">{isNew ? "New Product SKU" : `Edit ${skuCode}`}</span>
          </div>
          <h1 className="wizard-title">
            {isNew ? "Create Product SKU" : `Configure: ${title || "Untitled SKU"}`}
          </h1>
          <p className="wizard-sub">
            Configure dual-tier governance, spot price limits, media sequence, and specifications.
          </p>
        </div>

        {/* Action Controls */}
        <div className="action-buttons">
          <button
            type="button"
            className="btn-draft"
            onClick={() => handleSave("DRAFT")}
            data-testid="btn-save-draft"
          >
            Save as Draft
          </button>
          <button
            type="button"
            className="btn-review"
            onClick={() => handleSave("REVIEW_REQUIRED")}
            data-testid="btn-submit-review"
          >
            Submit for Review
          </button>
          <button
            type="button"
            className="btn-publish"
            onClick={() => handleSave("ACTIVE")}
            data-testid="btn-publish-product"
          >
            ✓ Publish SKU
          </button>
        </div>
      </div>

      <div className="wizard-grid">
        {/* Left Column: Core Configuration Form */}
        <div className="wizard-main-col">
          {/* Section 1: Dual-Tier Governance Switcher */}
          <div className="form-card" data-testid="tier-selector-card">
            <h2 className="card-title">1. Dual-Tier Quality Governance (PRD §3.1)</h2>
            <p className="card-desc">
              Select product authenticity tier. Authentic requires verified distributor info; Budget Smart requires OEM inspection specs.
            </p>

            <div className="tier-toggle-grid">
              <label
                className={`tier-option ${tier === "AUTHENTIC" ? "selected tier-auth-selected" : ""}`}
              >
                <input
                  type="radio"
                  name="productTier"
                  value="AUTHENTIC"
                  checked={tier === "AUTHENTIC"}
                  onChange={() => setTier("AUTHENTIC")}
                  className="tier-radio"
                />
                <div className="tier-option-content">
                  <div className="tier-label-row">
                    <span className="tier-badge-auth">👑 100% Authentic</span>
                    <span className="tier-sub">Official Distributor</span>
                  </div>
                  <p className="tier-help">
                    Requires verified distributor documentation. Backed by manufacturer official warranty.
                  </p>
                </div>
              </label>

              <label
                className={`tier-option ${tier === "BUDGET_SMART" ? "selected tier-budget-selected" : ""}`}
              >
                <input
                  type="radio"
                  name="productTier"
                  value="BUDGET_SMART"
                  checked={tier === "BUDGET_SMART"}
                  onChange={() => setTier("BUDGET_SMART")}
                  className="tier-radio"
                />
                <div className="tier-option-content">
                  <div className="tier-label-row">
                    <span className="tier-badge-budget">⚡ Budget Smart (Tested OEM)</span>
                    <span className="tier-sub">Nawabpur Godown QC</span>
                  </div>
                  <p className="tier-help">
                    Tested OEM replacement components. Backed by NCAMart 72h doorstep replacement warranty.
                  </p>
                </div>
              </label>
            </div>

            {/* Tier-Specific Governance Requirements */}
            {tier === "AUTHENTIC" ? (
              <div className="tier-req-box auth-box">
                <label className="input-label">
                  Official Importer / Distributor Name <span className="req-star">*</span>
                </label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="e.g. Anker Bangladesh Ltd. / Smart Technologies BD"
                  value={distributorName}
                  onChange={(e) => setDistributorName(e.target.value)}
                  data-testid="input-distributor-name"
                />
                <span className="input-hint">Mandatory for 100% Authentic seal badge generation</span>
              </div>
            ) : (
              <div className="tier-req-box budget-box">
                <label className="input-label">OEM Lab QC Benchmark Reference</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="e.g. NCAMart Lab Batch Test #QC-OEM-2026-B4"
                  value={oemReport}
                  onChange={(e) => setOemReport(e.target.value)}
                  data-testid="input-oem-test-ref"
                />
                <span className="input-hint">Ensures OEM components match claimed wattage and tolerances</span>
              </div>
            )}
          </div>

          {/* Section 2: Basic Details */}
          <div className="form-card">
            <h2 className="card-title">2. Product Identity &amp; Classification</h2>

            <div className="form-row">
              <div className="form-group flex-2">
                <label className="input-label">Product Title</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="e.g. Anker 735 GaNPrime 65W Fast Charger (3-Port)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="input-product-title"
                />
              </div>

              <div className="form-group flex-1">
                <label className="input-label">SKU Code</label>
                <input
                  type="text"
                  className="text-input font-mono"
                  placeholder="e.g. ANK-735-65W"
                  value={skuCode}
                  onChange={(e) => setSkuCode(e.target.value.toUpperCase())}
                  data-testid="input-sku-code"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group flex-1">
                <label className="input-label">Brand</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="e.g. Anker, Baseus, MINIWARE"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                />
              </div>

              <div className="form-group flex-1">
                <label className="input-label">Category</label>
                <select
                  className="text-input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  data-testid="select-product-category"
                >
                  {DEFAULT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Dynamic Category Specifications */}
          <div className="form-card" data-testid="category-specs-card">
            <h2 className="card-title">3. Category Specifications ({category})</h2>
            <p className="card-desc">
              Custom attributes rendered dynamically based on selected accessory taxonomy.
            </p>

            <div className="specs-fields-grid">
              {currentCategorySpecs.map((spec) => (
                <div key={spec.key} className="form-group">
                  <label className="input-label">
                    {spec.label} {spec.unit ? `(${spec.unit})` : ""}
                  </label>
                  <input
                    type="text"
                    className="text-input"
                    placeholder={spec.placeholder}
                    value={specs[spec.key] || ""}
                    onChange={(e) => handleSpecChange(spec.key, e.target.value)}
                    data-testid={`spec-input-${spec.key}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Multi-Media Drag & Drop Uploader */}
          <div className="form-card" data-testid="media-manager-card">
            <h2 className="card-title">4. Multi-Media Sequence &amp; Unboxing Video</h2>
            <p className="card-desc">
              Drag-to-reorder thumbnail sequence. The first item is published as the primary storefront hero image.
            </p>

            <div className="media-items-grid">
              {mediaList.map((media, idx) => (
                <div
                  key={media.id}
                  className={`media-card ${media.isPrimary ? "primary-media" : ""}`}
                >
                  <div className="media-preview-wrap">
                    {media.type === "IMAGE" ? (
                      <img src={media.url} alt="" className="media-img" />
                    ) : (
                      <div className="video-thumb-preview">
                        <span className="play-icon">▶</span>
                        <span className="video-tag">VIDEO</span>
                      </div>
                    )}
                    {media.isPrimary && <span className="primary-tag">Primary Hero</span>}
                  </div>

                  <div className="media-info">
                    <span className="media-name">{media.name}</span>
                    <div className="media-reorder-buttons">
                      <button
                        type="button"
                        className="btn-order"
                        disabled={idx === 0}
                        onClick={() => moveMedia(idx, idx - 1)}
                        aria-label="Move left"
                      >
                        ◀
                      </button>
                      <button
                        type="button"
                        className="btn-order"
                        disabled={idx === mediaList.length - 1}
                        onClick={() => moveMedia(idx, idx + 1)}
                        aria-label="Move right"
                      >
                        ▶
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Pricing & Live Margin Calculator HUD */}
        <div className="wizard-side-col">
          <div className="margin-calculator-card" data-testid="margin-calculator-card">
            <div className="margin-header">
              <span className="calc-pill">Live Commercial Modeling</span>
              <h3 className="calc-title">Pricing &amp; Margin Engine</h3>
            </div>

            <div className="calc-inputs-group">
              <div className="calc-field">
                <label className="calc-label">Wholesale Baseline Cost (BDT)</label>
                <div className="currency-input-wrap">
                  <span className="curr-sym">৳</span>
                  <input
                    type="number"
                    className="calc-input"
                    value={wholesaleBdt}
                    onChange={(e) => setWholesaleBdt(e.target.value)}
                    data-testid="input-wholesale-cost"
                  />
                </div>
                <span className="field-note">Spot baseline negotiated with Nawabpur stalls</span>
              </div>

              <div className="calc-field">
                <label className="calc-label">Max Allowed Spot Price Cap (BDT)</label>
                <div className="currency-input-wrap">
                  <span className="curr-sym">৳</span>
                  <input
                    type="number"
                    className="calc-input"
                    value={maxSpotBdt}
                    onChange={(e) => setMaxSpotBdt(e.target.value)}
                    data-testid="input-max-spot-price"
                  />
                </div>
                <span className="field-note">Runner requires supervisor override if above this</span>
              </div>

              <div className="calc-field">
                <label className="calc-label">Retail Selling Price (BDT)</label>
                <div className="currency-input-wrap">
                  <span className="curr-sym">৳</span>
                  <input
                    type="number"
                    className="calc-input font-bold"
                    value={retailBdt}
                    onChange={(e) => setRetailBdt(e.target.value)}
                    data-testid="input-retail-price"
                  />
                </div>
                <span className="field-note">Customer checkout price on storefront</span>
              </div>
            </div>

            {/* Live Calculation Output Card */}
            <div className="calc-result-box">
              <div className="result-row">
                <span>Gross Profit per Unit:</span>
                <strong className={profitPaisa > 0 ? "text-emerald" : "text-crimson"}>
                  {formatPaisa(profitPaisa)}
                </strong>
              </div>

              <div className="result-row margin-row">
                <span>Commercial Gross Margin:</span>
                <span
                  className={`margin-display-pill ${
                    isHealthyMargin ? "healthy-margin" : "low-margin"
                  }`}
                  data-testid="margin-display-pill"
                >
                  +{marginPercent}%
                </span>
              </div>

              <div className="margin-status-msg">
                {isHealthyMargin ? (
                  <span className="msg-ok">✓ Commercial margin exceeds target threshold (&gt;10%).</span>
                ) : (
                  <span className="msg-warn">⚠️ Thin margin alert: Recommend adjusting wholesale limit.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .product-wizard-view {
          flex: 1;
          padding: 24px 32px;
          background: #020617;
          min-height: 100vh;
          color: #f8fafc;
          font-family: var(--font-sans, system-ui, sans-serif);
        }

        .wizard-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .crumb-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          margin-bottom: 4px;
        }

        .back-link {
          color: #38bdf8;
          text-decoration: none;
          font-weight: 700;
        }

        .sep {
          color: #64748b;
        }

        .crumb-current {
          color: #94a3b8;
        }

        .wizard-title {
          font-size: 24px;
          font-weight: 900;
          margin: 0 0 4px 0;
          letter-spacing: -0.4px;
        }

        .wizard-sub {
          font-size: 13px;
          color: #94a3b8;
          margin: 0;
        }

        .action-buttons {
          display: flex;
          gap: 10px;
        }

        .btn-draft,
        .btn-review,
        .btn-publish {
          padding: 10px 16px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 800;
          border: none;
          cursor: pointer;
          transition: transform 0.12s ease;
        }

        .btn-draft {
          background: rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .btn-review {
          background: #3b82f6;
          color: #fff;
        }

        .btn-publish {
          background: #10b981;
          color: #022c22;
        }

        .btn-publish:hover {
          background: #34d399;
          transform: translateY(-1px);
        }

        /* Layout Grid */
        .wizard-grid {
          display: grid;
          grid-template-columns: 2.2fr 1fr;
          gap: 24px;
        }

        @media (max-width: 1024px) {
          .wizard-grid {
            grid-template-columns: 1fr;
          }
        }

        .wizard-main-col {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-card {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 20px;
        }

        .card-title {
          font-size: 15px;
          font-weight: 800;
          margin: 0 0 4px 0;
          color: #f8fafc;
        }

        .card-desc {
          font-size: 12px;
          color: #94a3b8;
          margin: 0 0 16px 0;
        }

        /* Tier Toggle */
        .tier-toggle-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 16px;
        }

        .tier-option {
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          padding: 14px;
          cursor: pointer;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          background: rgba(255, 255, 255, 0.02);
          transition: border-color 0.15s ease, background 0.15s ease;
        }

        .tier-auth-selected {
          border-color: #f59e0b;
          background: rgba(245, 158, 11, 0.08);
        }

        .tier-budget-selected {
          border-color: #14b8a6;
          background: rgba(20, 184, 166, 0.08);
        }

        .tier-radio {
          margin-top: 3px;
        }

        .tier-label-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .tier-badge-auth {
          font-size: 12px;
          font-weight: 800;
          color: #f59e0b;
        }

        .tier-badge-budget {
          font-size: 12px;
          font-weight: 800;
          color: #14b8a6;
        }

        .tier-sub {
          font-size: 10px;
          color: #94a3b8;
        }

        .tier-help {
          font-size: 11px;
          color: #94a3b8;
          margin: 0;
          line-height: 1.4;
        }

        .tier-req-box {
          border-radius: 8px;
          padding: 14px;
        }

        .auth-box {
          background: rgba(245, 158, 11, 0.05);
          border: 1px dashed rgba(245, 158, 11, 0.3);
        }

        .budget-box {
          background: rgba(20, 184, 166, 0.05);
          border: 1px dashed rgba(20, 184, 166, 0.3);
        }

        .req-star {
          color: #ef4444;
        }

        /* Form Inputs */
        .form-row {
          display: flex;
          gap: 12px;
          margin-bottom: 14px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .flex-1 {
          flex: 1;
        }

        .flex-2 {
          flex: 2;
        }

        .input-label {
          font-size: 11px;
          font-weight: 700;
          color: #cbd5e1;
        }

        .input-hint {
          font-size: 10px;
          color: #64748b;
          margin-top: 2px;
        }

        .text-input {
          background: #020617;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 10px 12px;
          color: #f8fafc;
          font-size: 12px;
          outline: none;
        }

        .text-input:focus {
          border-color: #f59e0b;
        }

        .font-mono {
          font-family: monospace;
        }

        /* Dynamic Specs */
        .specs-fields-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        /* Media */
        .media-items-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 12px;
        }

        .media-card {
          background: #0b1329;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .primary-media {
          border-color: #f59e0b;
        }

        .media-preview-wrap {
          position: relative;
          height: 100px;
          background: #1e293b;
        }

        .media-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .video-thumb-preview {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }

        .play-icon {
          font-size: 24px;
          color: #38bdf8;
        }

        .video-tag {
          font-size: 9px;
          font-weight: 800;
          color: #38bdf8;
        }

        .primary-tag {
          position: absolute;
          top: 6px;
          left: 6px;
          background: #f59e0b;
          color: #0f172a;
          font-size: 9px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .media-info {
          padding: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .media-name {
          font-size: 10px;
          color: #94a3b8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 70px;
        }

        .media-reorder-buttons {
          display: flex;
          gap: 2px;
        }

        .btn-order {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: #cbd5e1;
          font-size: 9px;
          padding: 2px 4px;
          border-radius: 3px;
          cursor: pointer;
        }

        .btn-order:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        /* Margin Calculator Card (Right Column) */
        .margin-calculator-card {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 20px;
          position: sticky;
          top: 80px;
        }

        .calc-pill {
          font-size: 10px;
          font-weight: 800;
          color: #f59e0b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .calc-title {
          font-size: 16px;
          font-weight: 900;
          margin: 4px 0 16px 0;
          color: #f8fafc;
        }

        .calc-inputs-group {
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-bottom: 20px;
        }

        .calc-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .calc-label {
          font-size: 11px;
          font-weight: 700;
          color: #cbd5e1;
        }

        .currency-input-wrap {
          display: flex;
          align-items: center;
          background: #020617;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 0 12px;
        }

        .curr-sym {
          color: #94a3b8;
          font-weight: 700;
        }

        .calc-input {
          flex: 1;
          background: none;
          border: none;
          color: #f8fafc;
          padding: 10px 8px;
          font-size: 13px;
          outline: none;
        }

        .field-note {
          font-size: 10px;
          color: #64748b;
        }

        /* Result Box */
        .calc-result-box {
          background: rgba(30, 41, 59, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .result-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          color: #cbd5e1;
        }

        .margin-row {
          padding-top: 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .margin-display-pill {
          font-size: 15px;
          font-weight: 900;
          padding: 3px 8px;
          border-radius: 6px;
        }

        .healthy-margin {
          background: rgba(16, 185, 129, 0.2);
          color: #10b981;
        }

        .low-margin {
          background: rgba(245, 158, 11, 0.2);
          color: #f59e0b;
        }

        .text-emerald {
          color: #10b981;
        }

        .text-crimson {
          color: #ef4444;
        }

        .margin-status-msg {
          font-size: 11px;
          margin-top: 4px;
        }

        .msg-ok {
          color: #10b981;
        }

        .msg-warn {
          color: #f59e0b;
        }
      `}</style>
    </div>
  );
}
