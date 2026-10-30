"use client";

import React, { useState, useEffect } from "react";
import { WishlistView } from "@/components/wishlist";
import type { WishlistItem } from "@/components/wishlist/types";

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchWishlist() {
      try {
        const res = await fetch("/api/v1/customer/wishlist");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data && Array.isArray(data.items)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mapped: WishlistItem[] = data.items.map((it: any, idx: number) => ({
              id: it.id || `wish_${idx}`,
              productId: it.productId || it.product_id,
              skuId: it.skuId || it.sku_id,
              slug: it.slug || "products",
              title: it.title || "Hardware Item",
              category: it.category || "Accessories",
              tier: it.tier || "AUTHENTIC",
              regularPricePaisa: it.regularPricePaisa || it.price_paisa || 0,
              currentPricePaisa: it.currentPricePaisa || it.price_paisa || 0,
              image: it.image || it.image_url,
              availability: it.availability || "IN_STOCK",
              priceDropAlert: Boolean(it.priceDropAlert),
              stockAlert: Boolean(it.stockAlert),
              addedAt: it.addedAt || it.created_at || new Date().toISOString(),
            }));
            setItems(mapped);
          }
        }
      } catch {
        // Safe empty fallback
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchWishlist();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>❤️</div>
        <p>Loading your saved wishlist items...</p>
      </div>
    );
  }

  return <WishlistView initialItems={items} />;
}
