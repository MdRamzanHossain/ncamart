import type { Metadata } from "next";
import { OrderKanbanBoard } from "@/components/admin/orders/OrderKanbanBoard";

export const metadata: Metadata = {
  title: "Order Fulfillment Kanban & Dispatch Pipeline | NCAMart Admin",
  description:
    "Live order state machine tracking from runner drop-and-pack to godown QC and courier consignment manifests.",
};

export default function AdminOrdersPage() {
  return <OrderKanbanBoard />;
}
