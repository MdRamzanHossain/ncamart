import type { Metadata } from "next";
import { ProductEditorWizard } from "@/components/admin/catalog/ProductEditorWizard";
import { MOCK_CATALOG_PRODUCTS } from "@/components/admin/catalog/mockData";

export const metadata: Metadata = {
  title: "Product SKU Editor & Governance | NCAMart Admin",
  description:
    "Configure dual-tier specifications, media sequence, and commercial margin thresholds.",
};

export default async function AdminProductEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isNew = id === "new";
  const existingProduct = MOCK_CATALOG_PRODUCTS.find((p) => p.id === id);

  return <ProductEditorWizard initialProduct={existingProduct} isNew={isNew} />;
}
