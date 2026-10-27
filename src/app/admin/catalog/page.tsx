import type { Metadata } from "next";
import { AdminCatalogListView } from "@/components/admin/catalog/AdminCatalogListView";

export const metadata: Metadata = {
  title: "Catalog & SKU Governance | NCAMart Admin",
  description:
    "Manage 100% Authentic and Budget Smart product SKUs, spot prices, and wholesale baselines.",
};

export default function AdminCatalogPage() {
  return <AdminCatalogListView />;
}
