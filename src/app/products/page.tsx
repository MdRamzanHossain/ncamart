"use client";

import React, { useState, useEffect, Suspense, useTransition, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { StorefrontShell } from "@/components/layout";
import {
  FacetedFilterSidebar,
  CatalogHeader,
  ProductGrid,
  CatalogFilterState,
  CatalogProduct,
} from "@/components/catalog";
import { Drawer } from "@/components/ui/drawer";
import Link from "next/link";

const SEED_CATALOG_PRODUCTS: CatalogProduct[] = [
  {
    id: "prod-1",
    slug: "baseus-65w-gan-ultra-fast-charger",
    title_en: "Baseus GaN5 Pro 65W Triple-Port Fast Charger",
    brand_name: "Baseus",
    product_tier: "AUTHENTIC",
    min_regular_price_paisa: 395000,
    min_sale_price_paisa: 345000,
    rating: 4.9,
    reviews_count: 128,
    availability: "IN_STOCK",
    icon: "⚡",
  },
  {
    id: "prod-2",
    slug: "mechanic-t12-pro-smart-soldering-station",
    title_en: "Mechanic T12 Pro Smart Soldering Station 72W",
    brand_name: "Mechanic",
    product_tier: "AUTHENTIC",
    min_regular_price_paisa: 520000,
    min_sale_price_paisa: 480000,
    rating: 4.8,
    reviews_count: 95,
    availability: "IN_STOCK",
    icon: "🔥",
  },
  {
    id: "prod-3",
    slug: "oem-t12-replacement-iron-tips-set-5pcs",
    title_en: "T12 Precision Soldering Iron Tips (Set of 5) OEM",
    brand_name: "Generic OEM",
    product_tier: "BUDGET_SMART",
    min_regular_price_paisa: 150000,
    min_sale_price_paisa: 125000,
    rating: 4.6,
    reviews_count: 64,
    availability: "IN_STOCK",
    icon: "🛠️",
  },
  {
    id: "prod-4",
    slug: "ugreen-100w-usb-c-braided-cable-2m",
    title_en: "UGREEN 100W USB-C E-Marker Kevlar Braided Cable (2m)",
    brand_name: "UGREEN",
    product_tier: "AUTHENTIC",
    min_regular_price_paisa: 135000,
    min_sale_price_paisa: 115000,
    rating: 4.9,
    reviews_count: 210,
    availability: "IN_STOCK",
    icon: "🔌",
  },
  {
    id: "prod-5",
    slug: "fluke-101-digital-multimeter-pocket",
    title_en: "Fluke 101 Basic Pocket Digital Multimeter (CAT III 600V)",
    brand_name: "Fluke",
    product_tier: "AUTHENTIC",
    min_regular_price_paisa: 550000,
    min_sale_price_paisa: 495000,
    rating: 5.0,
    reviews_count: 78,
    availability: "IN_STOCK",
    icon: "🔬",
  },
  {
    id: "prod-6",
    slug: "oem-usb-c-pd-trigger-tester-board",
    title_en: "Type-C PD/QC Fast Charge Decoy Trigger Board 20V",
    brand_name: "Generic OEM",
    product_tier: "BUDGET_SMART",
    min_regular_price_paisa: 45000,
    min_sale_price_paisa: 35000,
    rating: 4.5,
    reviews_count: 42,
    availability: "IN_STOCK",
    icon: "⚙️",
  },
  {
    id: "prod-7",
    slug: "anker-737-power-bank-24000mah-140w",
    title_en: "Anker 737 GaN 140W PowerCore 24K Smart Screen",
    brand_name: "Anker",
    product_tier: "AUTHENTIC",
    min_regular_price_paisa: 1500000,
    min_sale_price_paisa: 1125000,
    rating: 4.9,
    reviews_count: 245,
    availability: "IN_STOCK",
    icon: "🔋",
  },
  {
    id: "prod-8",
    slug: "sunshine-ss-057-hydrogel-screen-film-pack",
    title_en: "Sunshine SS-057 Flexible Hydrogel Protector Sheet 50pcs",
    brand_name: "Sunshine",
    product_tier: "BUDGET_SMART",
    min_regular_price_paisa: 220000,
    min_sale_price_paisa: 185000,
    rating: 4.7,
    reviews_count: 83,
    availability: "IN_STOCK",
    icon: "📱",
  },
];

function CatalogContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Derive category from path if navigating to /catalog/[slug] or /categories/[slug]
  const pathCategory = React.useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    if ((parts[0] === "catalog" || parts[0] === "categories") && parts.length > 1) {
      return parts[parts.length - 1];
    }
    return "";
  }, [pathname]);

  // Initialize filters from URL query parameters
  const [filters, setFilters] = useState<CatalogFilterState>(() => ({
    tier: (searchParams.get("tier") as "AUTHENTIC" | "BUDGET_SMART") || "",
    category: searchParams.get("category") || pathCategory || "",
    brand: searchParams.get("brand") || "",
    minPrice: searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined,
    maxPrice: searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined,
    inStockOnly: searchParams.get("inStockOnly") === "true",
    wattage: searchParams.get("wattage") || "",
  }));

  // Sync filter state when URL searchParams or path changes via Navbar/MegaMenu navigation
  useEffect(() => {
    setFilters({
      tier: (searchParams.get("tier") as "AUTHENTIC" | "BUDGET_SMART") || "",
      category: searchParams.get("category") || pathCategory || "",
      brand: searchParams.get("brand") || "",
      minPrice: searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined,
      maxPrice: searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined,
      inStockOnly: searchParams.get("inStockOnly") === "true",
      wattage: searchParams.get("wattage") || "",
    });
    if (searchParams.get("sort")) {
      setSort(searchParams.get("sort") || "NEWEST");
    }
  }, [searchParams, pathCategory]);

  const [sort, setSort] = useState<string>(searchParams.get("sort") || "NEWEST");
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<CatalogProduct[]>(SEED_CATALOG_PRODUCTS);
  const [comparedProducts, setComparedProducts] = useState<CatalogProduct[]>([]);

  // Push updated filter state to URL query parameters
  const syncUrlParams = useCallback(
    (newFilters: CatalogFilterState, newSort: string) => {
      const params = new URLSearchParams();
      if (newFilters.tier) params.set("tier", newFilters.tier);
      if (newFilters.category) params.set("category", newFilters.category);
      if (newFilters.brand) params.set("brand", newFilters.brand);
      if (newFilters.minPrice) params.set("minPrice", newFilters.minPrice.toString());
      if (newFilters.maxPrice) params.set("maxPrice", newFilters.maxPrice.toString());
      if (newFilters.inStockOnly) params.set("inStockOnly", "true");
      if (newFilters.wattage) params.set("wattage", newFilters.wattage);
      if (newSort && newSort !== "NEWEST") params.set("sort", newSort);

      const query = params.toString();
      startTransition(() => {
        router.push(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
      });
    },
    [router, pathname]
  );

  const handleFilterChange = (newFilters: CatalogFilterState) => {
    setFilters(newFilters);
    syncUrlParams(newFilters, sort);
  };

  const handleSortChange = (newSort: string) => {
    setSort(newSort);
    syncUrlParams(filters, newSort);
  };

  const handleResetFilters = () => {
    const emptyFilters: CatalogFilterState = {
      tier: "",
      category: "",
      brand: "",
      minPrice: undefined,
      maxPrice: undefined,
      inStockOnly: false,
      wattage: "",
    };
    setFilters(emptyFilters);
    syncUrlParams(emptyFilters, "NEWEST");
  };

  const handleRemoveFilter = (key: keyof CatalogFilterState) => {
    const updated = { ...filters, [key]: undefined };
    if (key === "tier") updated.tier = "";
    if (key === "category") updated.category = "";
    if (key === "brand") updated.brand = "";
    if (key === "inStockOnly") updated.inStockOnly = false;
    if (key === "wattage") updated.wattage = "";

    setFilters(updated);
    syncUrlParams(updated, sort);
  };

  // Filter & sort logic applied to catalog products
  useEffect(() => {
    setIsLoading(true);

    const timer = setTimeout(() => {
      let filtered = [...SEED_CATALOG_PRODUCTS];

      if (filters.tier) {
        filtered = filtered.filter((p) => p.product_tier === filters.tier);
      }
      if (filters.brand) {
        filtered = filtered.filter((p) =>
          p.brand_name?.toLowerCase().includes(filters.brand!.toLowerCase())
        );
      }
      if (filters.minPrice) {
        filtered = filtered.filter((p) => p.min_sale_price_paisa >= filters.minPrice! * 100);
      }
      if (filters.maxPrice) {
        filtered = filtered.filter((p) => p.min_sale_price_paisa <= filters.maxPrice! * 100);
      }

      // Sort
      if (sort === "PRICE_ASC") {
        filtered.sort((a, b) => a.min_sale_price_paisa - b.min_sale_price_paisa);
      } else if (sort === "PRICE_DESC") {
        filtered.sort((a, b) => b.min_sale_price_paisa - a.min_sale_price_paisa);
      }

      setProducts(filtered);
      setIsLoading(false);
    }, 120);

    return () => clearTimeout(timer);
  }, [filters, sort]);

  // Comparison tray handler
  const handleToggleCompare = (product: CatalogProduct) => {
    setComparedProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      if (exists) {
        return prev.filter((p) => p.id !== product.id);
      } else {
        if (prev.length >= 4) {
          return prev; // Max 4 items allowed for comparison
        }
        return [...prev, product];
      }
    });
  };

  return (
    <div
      style={{
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "var(--space-xl) var(--space-md)",
      }}
    >
      {/* Page Title & Breadcrumb */}
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginBottom: "4px" }}>
          <Link href="/" style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>Home</Link>
          {" / "}
          <span style={{ color: "var(--text-secondary)" }}>Master Catalog</span>
        </div>
        <h1
          style={{
            fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
            fontWeight: "900",
            color: "var(--text-primary)",
            margin: 0,
            letterSpacing: "-0.03em",
          }}
        >
          Tech Accessories & Engineering Tools
        </h1>
      </div>

      {/* Main 2-Column Layout: Sidebar + Product Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr",
          gap: "var(--space-xl)",
          alignItems: "flex-start",
        }}
        className="catalog-layout-grid"
      >
        {/* Desktop Sidebar */}
        <div className="desktop-filter-sidebar" style={{ position: "sticky", top: "100px" }}>
          <FacetedFilterSidebar
            filters={filters}
            onFilterChange={handleFilterChange}
            onReset={handleResetFilters}
          />
        </div>

        {/* Catalog Main Content */}
        <div>
          <CatalogHeader
            totalItems={SEED_CATALOG_PRODUCTS.length}
            shownItems={products.length}
            filters={filters}
            sort={sort}
            onSortChange={handleSortChange}
            onRemoveFilter={handleRemoveFilter}
            onClearAll={handleResetFilters}
            onOpenMobileFilters={() => setIsMobileDrawerOpen(true)}
          />

          <ProductGrid
            products={products}
            isLoading={isLoading}
            comparedIds={comparedProducts.map((p) => p.id)}
            onToggleCompare={handleToggleCompare}
            onClearFilters={handleResetFilters}
          />
        </div>
      </div>

      {/* Mobile Slide-Over Filter Drawer */}
      <Drawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        title="Filter Products"
        position="bottom"
      >
        <div style={{ padding: "var(--space-md)" }}>
          <FacetedFilterSidebar
            filters={filters}
            onFilterChange={(newFilters) => {
              handleFilterChange(newFilters);
              setIsMobileDrawerOpen(false);
            }}
            onReset={() => {
              handleResetFilters();
              setIsMobileDrawerOpen(false);
            }}
          />
        </div>
      </Drawer>

      {/* Sticky Bottom Comparison Tray (When 2+ items selected) */}
      {comparedProducts.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: "80px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: "var(--z-index-sticky)",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--tier-authentic-gold)",
            borderRadius: "var(--radius-xl)",
            padding: "10px 18px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(245, 158, 11, 0.3)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-md)",
            backdropFilter: "blur(12px)",
            animation: "slideUp var(--duration-fast) cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {comparedProducts.map((p) => (
              <div
                key={p.id}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--bg-canvas)",
                  border: "1px solid var(--border-default)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  position: "relative",
                }}
              >
                <span>{p.icon || "⚡"}</span>
                <button
                  type="button"
                  onClick={() => handleToggleCompare(p)}
                  style={{
                    position: "absolute",
                    top: "-4px",
                    right: "-4px",
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    backgroundColor: "#ef4444",
                    color: "#ffffff",
                    border: "none",
                    fontSize: "9px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                  aria-label={`Remove ${p.title_en} from comparison`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: "600" }}>
            {comparedProducts.length} of 4 items
          </div>

          <Link
            href={`/compare?ids=${comparedProducts.map((p) => p.id).join(",")}`}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--tier-authentic-gold)",
              color: "#0b0f19",
              fontWeight: "800",
              fontSize: "var(--font-size-xs)",
              textDecoration: "none",
            }}
          >
            Compare Now →
          </Link>
        </div>
      )}

      <style jsx global>{`
        @media (max-width: 900px) {
          .catalog-layout-grid {
            grid-template-columns: 1fr !important;
          }
          .desktop-filter-sidebar {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <StorefrontShell>
      <Suspense
        fallback={
          <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--text-secondary)" }}>
            Loading catalog filters...
          </div>
        }
      >
        <CatalogContent />
      </Suspense>
    </StorefrontShell>
  );
}
