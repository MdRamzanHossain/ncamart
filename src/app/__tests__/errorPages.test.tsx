import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import GlobalAppError from "../error";
import NotFound from "../not-found";

describe("Application Error & 404 Pages", () => {
  it("renders GlobalAppError with bilingual message, try again button, and technical diagnostics", () => {
    const mockError = new Error("Connection timed out to Nawabpur Hub");
    (mockError as any).digest = "DIGEST-TEST-8849";
    const mockReset = vi.fn();

    const html = renderToString(
      <GlobalAppError error={mockError as any} reset={mockReset} />
    );

    // Verify Title & Bilingual Content
    expect(html).toContain("System Disruption Encountered");
    expect(html).toContain("সিস্টেমে অপ্রত্যাশিত সমস্যা দেখা দিয়েছে");
    expect(html).toContain("Nawabpur Telemetry Guard");

    // Verify Action buttons
    expect(html).toContain("error-try-again-btn");
    expect(html).toContain("Try Again (পুনরায় চেষ্টা করুন)");
    expect(html).toContain("error-home-btn");
    expect(html).toContain("Go to Storefront (মূল পাতায় ফিরুন)");

    // Verify Support Links
    expect(html).toContain("WhatsApp Hotline");
    expect(html).toContain("Verify Hologram");

    // Verify Diagnostics
    expect(html).toContain("Technical Diagnostics &amp; Digest ID");
    expect(html).toContain("DIGEST-T");
  });

  it("renders NotFound 404 page with 404 badge, bilingual guidance, and shortcuts", () => {
    const html = renderToString(<NotFound />);

    // Verify 404 and Titles
    expect(html).toContain("404");
    expect(html).toContain("LOST IN NAWABPUR");
    expect(html).toContain("Resource or Lane Not Found");
    expect(html).toContain("নির্দিষ্ট পৃষ্ঠা বা পণ্যটি পাওয়া যায়নি");

    // Verify Action Buttons
    expect(html).toContain("btn-404-home");
    expect(html).toContain("Back to Storefront (হোমপেজে ফিরুন)");
    expect(html).toContain("btn-404-catalog");
    expect(html).toContain("Browse All Accessories (ক্যাটালগ)");

    // Verify Shortcut destinations
    expect(html).toContain("Verify Seal");
    expect(html).toContain("Pre-Orders");
    expect(html).toContain("Compare Specs");
  });
});
