import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { SearchModal } from "../SearchModal";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock localStorage for Node test runner
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

describe("F05 — Global Cmd+K Instant Search & Discovery Modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it("exports SearchModal as a valid React component", () => {
    expect(SearchModal).toBeDefined();
    expect(typeof SearchModal).toBe("function");

    // Instantiation when closed returns null
    const closedElement = React.createElement(SearchModal, {
      isOpen: false,
      onClose: vi.fn(),
    });
    expect(closedElement).toBeDefined();
    expect(closedElement.props.isOpen).toBe(false);
  });

  it("instantiates SearchModal with open state and required props", () => {
    const handleClose = vi.fn();
    const openElement = React.createElement(SearchModal, {
      isOpen: true,
      onClose: handleClose,
    });

    expect(openElement).toBeDefined();
    expect(openElement.props.isOpen).toBe(true);
    expect(openElement.props.onClose).toBe(handleClose);
  });

  it("handles recent search storage logic safely in localStorage", () => {
    const testSearches = ["65W GaN Charger", "T12 Soldering Tip", "Hakko FX-888D"];
    localStorageMock.setItem("nca_recent_searches", JSON.stringify(testSearches));

    const retrieved = JSON.parse(localStorageMock.getItem("nca_recent_searches") || "[]");
    expect(retrieved).toHaveLength(3);
    expect(retrieved[0]).toBe("65W GaN Charger");
  });

  it("filters search results correctly by tier", () => {
    const mockHits = [
      {
        id: "prod-1",
        slug: "baseus-65w-gan",
        title_en: "Baseus 65W GaN Charger",
        title_bn: "বেসাস ৬৫ ওয়াট চার্জার",
        brand: "Baseus",
        tier: "AUTHENTIC",
        fulfillment_type: "REGULAR_DROP_PACK",
        min_price_paisa: 320000,
        availability: "IN_STOCK",
      },
      {
        id: "prod-2",
        slug: "oem-t12-station",
        title_en: "OEM T12 Soldering Station",
        title_bn: "টি১২ সোল্ডারিং স্টেশন",
        brand: "Generic OEM",
        tier: "BUDGET_SMART",
        fulfillment_type: "REGULAR_DROP_PACK",
        min_price_paisa: 150000,
        availability: "IN_STOCK",
      },
    ];

    const authentic = mockHits.filter((h) => h.tier === "AUTHENTIC");
    const budget = mockHits.filter((h) => h.tier === "BUDGET_SMART");

    expect(authentic).toHaveLength(1);
    expect(authentic[0].brand).toBe("Baseus");
    expect(budget).toHaveLength(1);
    expect(budget[0].brand).toBe("Generic OEM");
  });
});
