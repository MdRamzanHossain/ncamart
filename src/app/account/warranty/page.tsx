"use client";

import React, { useState, useEffect } from "react";
import { WarrantyPortalView } from "@/components/rma/WarrantyPortalView";
import type { ActiveWarranty } from "@/components/rma/types";

export default function WarrantiesPortalPage() {
  const [warranties, setWarranties] = useState<ActiveWarranty[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchWarranties() {
      try {
        const res = await fetch("/api/v1/customer/warranties");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mapped: ActiveWarranty[] = data.map((w: any) => ({
              id: w.id,
              orderNumber: w.orderNumber || w.order_number || "NCA-ORDER",
              sealId: w.sealId || w.seal_id || "NCA-SEAL",
              productTitleEn: w.productTitleEn || w.product_title_en || "Authentic Component",
              productTitleBn: w.productTitleBn || w.product_title_bn || "জেনুইন কম্পোনেন্ট",
              brandName: w.brandName || w.brand_name || "NCA Partner",
              serialNumber: w.serialNumber || w.serial_number || "SN-VERIFIED",
              deliveredAt: w.deliveredAt || w.delivered_at || new Date().toISOString(),
              expiresAt: w.expiresAt || w.expires_at || new Date().toISOString(),
              warrantyDaysTotal: w.warrantyDaysTotal || w.warranty_days_total || 365,
              coverageType: w.coverageType || w.coverage_type || "OFFICIAL_DISTRIBUTOR_18_MONTH",
              coverageLabel: w.coverageLabel || w.coverage_label || "Official Distributor Warranty",
              imageUrl: w.imageUrl || w.image_url,
              status: w.status || "ACTIVE",
            }));
            setWarranties(mapped);
          }
        }
      } catch {
        // Safe empty fallback
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchWarranties();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>🛡️</div>
        <p>Loading your active warranties...</p>
      </div>
    );
  }

  return <WarrantyPortalView initialWarranties={warranties} />;
}
