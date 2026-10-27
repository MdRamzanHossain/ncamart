import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { ShowroomPosView } from "../ShowroomPosView";
import { playPosBeep } from "../useBarcodeScanner";
import { ToastProvider } from "@/components/ui/toast";

describe("F27: Showroom Counter POS Touch-Screen Billing Console", () => {
  it("renders ShowroomPosView with top status bar, staff credentials and cash drawer", () => {
    const html = renderToString(
      <ToastProvider>
        <ShowroomPosView />
      </ToastProvider>
    );

    // Brand and Counter
    expect(html).toContain("NCAMart POS");
    expect(html).toContain("Showroom Counter #1");
    expect(html).toContain("Nawabpur Central Godown Sync Online");

    // Staff RBAC role & session
    expect(html).toContain("SHOWROOM_AGENT");
    expect(html).toContain("Rashid Alam");
    expect(html).toContain("Drawer Active");
    expect(html).toContain("৳10,000 Float");
  });

  it("renders Barcode Scanner HUD, simulation chips, and product touch grid", () => {
    const html = renderToString(
      <ToastProvider>
        <ShowroomPosView />
      </ToastProvider>
    );

    // Scanner HUD
    expect(html).toContain("Laser Barcode Gun Active");
    expect(html).toContain("Anker 65W");
    expect(html).toContain("Rigol Scope");
    expect(html).toContain("TS101 Iron");

    // Category pills
    expect(html).toContain("Fast Chargers");
    expect(html).toContain("Oscilloscopes");
    expect(html).toContain("Soldering");

    // Product cards
    expect(html).toContain("ANK-735-65W");
    expect(html).toContain("RGL-DS1054Z");
    expect(html).toContain("in counter");
  });

  it("renders customer panel, cart container, and tender panel with cash calculator", () => {
    const html = renderToString(
      <ToastProvider>
        <ShowroomPosView />
      </ToastProvider>
    );

    // Customer
    expect(html).toContain("Walk-in Guest");
    expect(html).toContain("Mobile 017...");

    // Empty cart state
    expect(html).toContain("Cart is empty");
    expect(html).toContain("Total Payable");

    // Payment method tabs
    expect(html).toContain("Cash");
    expect(html).toContain("bKash POS");
    expect(html).toContain("Card POS");
    expect(html).toContain("Store Credit");

    // Cash Tendered quick buttons
    expect(html).toContain("Exact");
    expect(html).toContain("+৳500");
    expect(html).toContain("+৳1,000");
    expect(html).toContain("+৳2,000");
    expect(html).toContain("+৳5,000");

    // CTA button
    expect(html).toContain("Complete Walk-in Sale &amp; Print Mushak 6.3");
  });

  it("playPosBeep does not throw in headless or SSR environments", () => {
    expect(() => playPosBeep()).not.toThrow();
  });
});
