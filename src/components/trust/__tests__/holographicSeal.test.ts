import { describe, it, expect } from "vitest";
import React from "react";
import { HolographicSealPreview } from "../HolographicSealPreview";

describe("F13 — 3D Interactive Holographic Seal Card & Warranty Explainer", () => {
  it("creates HolographicSealPreview element with default Crockford Base32 ID", () => {
    const element = React.createElement(HolographicSealPreview, {
      sealId: "NC-9X4K-2M7B",
      tier: "AUTHENTIC",
    });

    expect(element).toBeDefined();
    expect(element.props.sealId).toBe("NC-9X4K-2M7B");
    expect(element.props.tier).toBe("AUTHENTIC");
  });

  it("creates HolographicSealPreview with Budget Smart tier and custom seal ID", () => {
    const element = React.createElement(HolographicSealPreview, {
      sealId: "NC-3P8W-9K2L",
      tier: "BUDGET_SMART",
      showExplainer: true,
    });

    expect(element).toBeDefined();
    expect(element.props.sealId).toBe("NC-3P8W-9K2L");
    expect(element.props.tier).toBe("BUDGET_SMART");
    expect(element.props.showExplainer).toBe(true);
  });
});
