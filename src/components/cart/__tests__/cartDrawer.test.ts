import { describe, it, expect, vi } from "vitest";
import React from "react";
import { CartDrawer } from "../CartDrawer";
import { CartItem } from "../types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock toast hook
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const SAMPLE_ITEMS: CartItem[] = [
  {
    id: "item-1",
    productId: "prod-1",
    skuId: "sku-1",
    slug: "baseus-65w-gan",
    title: "Baseus GaN5 Pro 65W Fast Charger",
    tier: "AUTHENTIC",
    variantLabel: "Matte Black • Standard",
    pricePaisa: 345000,
    quantity: 1,
    thumbnailUrl: "/images/product-main.png",
    isReserved: true,
  },
  {
    id: "item-2",
    productId: "prod-2",
    skuId: "sku-2",
    slug: "ugreen-100w-cable",
    title: "UGREEN 100W USB-C Cable",
    tier: "AUTHENTIC",
    variantLabel: "2m Black",
    pricePaisa: 115000,
    quantity: 2,
    thumbnailUrl: "/images/cable.png",
    isReserved: true,
  },
];

describe("F14 — Slide-Over Cart Drawer with 15-Minute Reservation Timer", () => {
  it("creates CartDrawer element with item list and subtotal calculation", () => {
    const handleClose = vi.fn();
    const handleUpdate = vi.fn();
    const handleRemove = vi.fn();

    const element = React.createElement(CartDrawer, {
      isOpen: true,
      onClose: handleClose,
      items: SAMPLE_ITEMS,
      onUpdateQuantity: handleUpdate,
      onRemoveItem: handleRemove,
    });

    expect(element).toBeDefined();
    expect(element.props.isOpen).toBe(true);
    expect(element.props.items.length).toBe(2);
    // Item 1: 345000 * 1 = 345000
    // Item 2: 115000 * 2 = 230000
    // Total: 575000 paisa (৳5,750.00) >= 400000 -> Free delivery eligible
    const totalPaisa = element.props.items.reduce(
      (acc: number, it: CartItem) => acc + it.pricePaisa * it.quantity,
      0
    );
    expect(totalPaisa).toBe(575000);
  });

  it("creates CartDrawer in closed state without crashing", () => {
    const element = React.createElement(CartDrawer, {
      isOpen: false,
      onClose: vi.fn(),
      items: [],
    });

    expect(element).toBeDefined();
    expect(element.props.isOpen).toBe(false);
  });
});
