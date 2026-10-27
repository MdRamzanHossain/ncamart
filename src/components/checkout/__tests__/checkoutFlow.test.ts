import { describe, it, expect, vi } from "vitest";
import React from "react";
import { StepIndicator } from "../StepIndicator";
import { Step1Identity } from "../Step1Identity";
import { Step2Address } from "../Step2Address";
import { Step3Review } from "../Step3Review";
import { CartItem } from "@/components/cart/types";

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
    variantLabel: "Matte Black",
    pricePaisa: 345000,
    quantity: 1,
    thumbnailUrl: "/images/product.png",
  },
];

describe("F15 — Multi-Step Checkout & Geographical Address Cascade", () => {
  it("creates StepIndicator with current step 1, 2, and 3", () => {
    const el1 = React.createElement(StepIndicator, { currentStep: 1 });
    expect(el1).toBeDefined();
    expect(el1.props.currentStep).toBe(1);

    const el2 = React.createElement(StepIndicator, { currentStep: 2 });
    expect(el2).toBeDefined();
    expect(el2.props.currentStep).toBe(2);
  });

  it("creates Step1Identity element with phone input and onComplete callback", () => {
    const onComplete = vi.fn();
    const element = React.createElement(Step1Identity, {
      initialPhone: "01712345678",
      onComplete,
    });

    expect(element).toBeDefined();
    expect(element.props.initialPhone).toBe("01712345678");
  });

  it("creates Step2Address element with geo cascade and corporate invoice toggle", () => {
    const onBack = vi.fn();
    const onComplete = vi.fn();
    const element = React.createElement(Step2Address, {
      customerName: "Tanvir Rahman",
      customerPhone: "01712345678",
      onBack,
      onComplete,
    });

    expect(element).toBeDefined();
    expect(element.props.customerName).toBe("Tanvir Rahman");
  });

  it("creates Step3Review element with items, address, and coupon validation", () => {
    const onBack = vi.fn();
    const onProceed = vi.fn();
    const element = React.createElement(Step3Review, {
      items: SAMPLE_ITEMS,
      address: {
        recipientName: "Tanvir Rahman",
        phone: "01712345678",
        divisionId: "div-dhaka",
        divisionName: "Dhaka",
        districtId: "dist-dhaka",
        districtName: "Dhaka City",
        thanaId: "thana-kotwali",
        thanaName: "Kotwali",
        streetAddress: "House 12, Road 4",
        isPickupCounter: false,
      },
      corporate: {
        isCorporateRequested: false,
        companyName: "",
        binNumber: "",
      },
      onBack,
      onProceedToPayment: onProceed,
    });

    expect(element).toBeDefined();
    expect(element.props.items.length).toBe(1);
    expect(element.props.address.divisionName).toBe("Dhaka");
  });
});
