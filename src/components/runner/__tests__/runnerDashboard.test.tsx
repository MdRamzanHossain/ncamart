import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { RunnerTaskDashboard } from "../RunnerTaskDashboard";
import { RunnerTaskCard } from "../RunnerTaskCard";
import { ToastProvider } from "@/components/ui/toast";
import type { RunnerTask } from "../types";

const MOCK_TASK_AT_STALL: RunnerTask = {
  id: "TASK-TEST-01",
  orderNumber: "NCA-2026-TEST",
  marketName: "Taher Tower Electrical Market",
  stallName: "Al-Madina Electronics Stall",
  stallNumber: "Shop #14",
  stallContactPhone: "01712-345678",
  skuTitle: "Anker 735 GaNPrime 65W Fast Charger (3-Port)",
  skuCode: "ANK-735-65W",
  quantity: 1,
  image: "/images/anker.jpg",
  targetWholesalePricePaisa: 380000,
  maxAllowedSpotPricePaisa: 410000,
  negotiatedSpotPricePaisa: 450000, // Exceeds 410000 max limit
  status: "AT_STALL",
  assignedAt: "10:15 AM",
};

describe("F29: Field-Runner Mobile PWA Task Dashboard", () => {
  it("renders RunnerTaskDashboard with mobile viewport, runner credentials, float, and zero customer PII banner", () => {
    const html = renderToString(
      <ToastProvider>
        <RunnerTaskDashboard />
      </ToastProvider>
    );

    // Runner identity & PWA header
    expect(html).toContain("FIELD_RUNNER");
    expect(html).toContain("ON DUTY");
    expect(html).toContain("Shakil Mollah");
    expect(html).toContain("৳15,000.00");

    // PRD §3.8 Zero Customer PII compliance
    expect(html).toContain("PRD §3.8 Zero Customer PII Protocol");
    expect(html).toContain("Runner sees wholesale stalls only");

    // Filter tabs
    expect(html).toContain("All Tasks");
    expect(html).toContain("Pending Pickup");
    expect(html).toContain("In Bag");

    // Market grouping
    expect(html).toContain("Taher Tower Electrical Market");
    expect(html).toContain("Nawabpur Road Hardware Lane");
  });

  it("renders RunnerTaskCard with wholesale stall information and spot price override alert when exceeding threshold", () => {
    const html = renderToString(
      <ToastProvider>
        <RunnerTaskCard
          task={MOCK_TASK_AT_STALL}
          onUpdateStatus={() => {}}
          onRequestOverride={() => {}}
          onApproveOverrideSimulated={() => {}}
        />
      </ToastProvider>
    );

    // Stall location info
    expect(html).toContain("Al-Madina Electronics Stall");
    expect(html).toContain("Shop #14");
    expect(html).toContain("01712-345678");

    // Target vs limit pricing
    expect(html).toContain("৳3,800.00");
    expect(html).toContain("৳4,100.00");

    // Threshold override alert & button
    expect(html).toContain("Supervisor Sourcing Override Required");
    expect(html).toContain("Request Supervisor Override");
  });

  it("renders stepper action button correctly for assigned task", () => {
    const assignedTask: RunnerTask = {
      ...MOCK_TASK_AT_STALL,
      status: "ASSIGNED",
    };

    const html = renderToString(
      <ToastProvider>
        <RunnerTaskCard
          task={assignedTask}
          onUpdateStatus={() => {}}
          onRequestOverride={() => {}}
          onApproveOverrideSimulated={() => {}}
        />
      </ToastProvider>
    );

    expect(html).toContain("Accept Task &amp; Begin Route");
  });
});
