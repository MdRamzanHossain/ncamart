"use client";

import React from "react";
import { ProductSkuVariant } from "./types";

export interface VariantSelectorProps {
  skus: ProductSkuVariant[];
  selectedSkuId: string;
  onSelectSku: (sku: ProductSkuVariant) => void;
}

export function VariantSelector({ skus, selectedSkuId, onSelectSku }: VariantSelectorProps) {
  if (!skus || skus.length <= 1) return null;

  // Extract all attribute keys across SKUs (e.g., "Color", "Wattage", "Ports")
  const attributeKeys = Array.from(
    new Set(skus.flatMap((s) => Object.keys(s.attributes || {})))
  );

  const selectedSku = skus.find((s) => s.id === selectedSkuId) || skus[0];

  const handleAttributeChange = (key: string, value: string) => {
    // Find the closest matching SKU with this attribute updated
    const targetAttributes = { ...selectedSku.attributes, [key]: value };
    
    // Exact match search
    const exactMatch = skus.find((s) =>
      Object.entries(targetAttributes).every(([k, v]) => s.attributes[k] === v)
    );

    if (exactMatch) {
      onSelectSku(exactMatch);
      return;
    }

    // Partial match fallback
    const partialMatch = skus.find((s) => s.attributes[key] === value);
    if (partialMatch) {
      onSelectSku(partialMatch);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
      {attributeKeys.map((attrKey) => {
        // Find distinct values for this attribute
        const values = Array.from(
          new Set(skus.map((s) => s.attributes[attrKey]).filter(Boolean))
        );

        const currentValue = selectedSku.attributes[attrKey];
        const isColorAttr = attrKey.toLowerCase().includes("color");

        return (
          <div key={attrKey} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#94a3b8", textTransform: "capitalize" }}>
                {attrKey}:{" "}
                <strong style={{ color: "#f8fafc", fontWeight: 700 }}>
                  {currentValue || "Default"}
                </strong>
              </span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {values.map((val) => {
                const isSelected = val === currentValue;
                
                // Check if any SKU with this attribute is in stock
                const hasStock = skus.some(
                  (s) => s.attributes[attrKey] === val && s.availability.status !== "OUT_OF_STOCK"
                );

                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleAttributeChange(attrKey, val)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: isSelected ? 700 : 500,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      border: isSelected
                        ? "2px solid #3b82f6"
                        : "1px solid rgba(255, 255, 255, 0.12)",
                      backgroundColor: isSelected ? "rgba(59, 130, 246, 0.12)" : "rgba(255, 255, 255, 0.03)",
                      color: isSelected ? "#93c5fd" : hasStock ? "#cbd5e1" : "#64748b",
                      opacity: hasStock ? 1 : 0.5,
                      boxShadow: isSelected ? "0 0 10px rgba(59, 130, 246, 0.25)" : "none",
                    }}
                  >
                    {isColorAttr && (
                      <span
                        style={{
                          width: "12px",
                          height: "12px",
                          borderRadius: "50%",
                          backgroundColor:
                            val.toLowerCase() === "black"
                              ? "#111827"
                              : val.toLowerCase() === "white"
                              ? "#f8fafc"
                              : val.toLowerCase() === "silver"
                              ? "#94a3b8"
                              : val.toLowerCase() === "blue"
                              ? "#2563eb"
                              : "#64748b",
                          border: "1px solid rgba(255, 255, 255, 0.3)",
                        }}
                      />
                    )}
                    <span>{val}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
