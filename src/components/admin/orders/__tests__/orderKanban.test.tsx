import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { OrderKanbanBoard } from "../OrderKanbanBoard";
import { CourierDispatchConsole } from "../CourierDispatchConsole";
import { ToastProvider } from "@/components/ui/toast";
import { MOCK_ADMIN_ORDERS } from "../mockData";

describe("F33: Admin Order Management Kanban & Dispatch Pipeline", () => {
  it("renders OrderKanbanBoard with all 6 fulfillment stages and summary header", () => {
    const html = renderToString(
      <ToastProvider>
        <OrderKanbanBoard />
      </ToastProvider>
    );

    expect(html).toContain("order-kanban-board");
    expect(html).toContain("Order Fulfillment Kanban Board");
    expect(html).toContain("Bulk Courier Dispatch");

    // All 6 Columns
    expect(html).toContain("kanban-col-PENDING_CONFIRMATION");
    expect(html).toContain("Pending Confirmation");

    expect(html).toContain("kanban-col-SOURCING_RUNNER");
    expect(html).toContain("Sourcing Runner");

    expect(html).toContain("kanban-col-AT_GODOWN_QC");
    expect(html).toContain("At Godown QC");

    expect(html).toContain("kanban-col-PACKED");
    expect(html).toContain("Packed &amp; Staged");

    expect(html).toContain("kanban-col-WITH_COURIER");
    expect(html).toContain("With Courier");

    expect(html).toContain("kanban-col-DELIVERED");
    expect(html).toContain("Delivered");
  });

  it("renders order cards with customer name, division, integer paisa BDT, and SLA breach indicator", () => {
    const html = renderToString(
      <ToastProvider>
        <OrderKanbanBoard />
      </ToastProvider>
    );

    // Order 84920 (breached SLA > 4h)
    expect(html).toContain("NCA-2026-84920");
    expect(html).toContain("Md. Tanvir Hossain");
    expect(html).toContain("Dhaka");
    expect(html).toContain("Mirpur-10");
    expect(html).toContain("৳9,600.00");
    expect(html).toContain("sla-urgent");
    expect(html).toContain("sla-breach-card");
    expect(html).toContain("4.5");

    // Advance button to next valid state machine transition
    expect(html).toContain("Advance to");
    expect(html).toContain("SOURCING_RUNNER");
  });

  it("renders CourierDispatchConsole with packed orders queue and courier API booking triggers", () => {
    const packedOrders = MOCK_ADMIN_ORDERS.filter((o) => o.status === "PACKED");
    const html = renderToString(
      <ToastProvider>
        <CourierDispatchConsole
          isOpen={true}
          packedOrders={packedOrders}
          onClose={() => {}}
          onDispatchSuccess={() => {}}
        />
      </ToastProvider>
    );

    expect(html).toContain("courier-dispatch-console");
    expect(html).toContain("Bulk Courier Dispatch Manifest");
    expect(html).toContain("Pathao Courier (Express API)");
    expect(html).toContain("Steadfast Logistics (National)");
    expect(html).toContain("Nawabpur Central Godown");
    expect(html).toContain("Packed Parcels Ready for Handover");
    expect(html).toContain("NCA-2026-84915");
    expect(html).toContain("Ahsan Habib");
    expect(html).toContain("Book &amp; Dispatch");
  });

  it("does not render CourierDispatchConsole when isOpen is false", () => {
    const html = renderToString(
      <ToastProvider>
        <CourierDispatchConsole
          isOpen={false}
          packedOrders={[]}
          onClose={() => {}}
          onDispatchSuccess={() => {}}
        />
      </ToastProvider>
    );

    expect(html).not.toContain("courier-dispatch-console");
  });
});
