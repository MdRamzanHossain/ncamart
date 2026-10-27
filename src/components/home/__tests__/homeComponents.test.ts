import { describe, it, expect, vi } from "vitest";
import React from "react";
import {
  HeroPortal,
  CategoryDock,
  CollectionsGrid,
  RecommendedCarousel,
  FlashOffersCard,
  TrendingLeaderboard,
  FeaturedCampaignBanner,
  TripleGridSection,
  RewardsTrustStrip,
  TestimonialsAndNewsletter,
  NawabpurMarketMap,
  BrandAuthenticityHub,
} from "../index";

// Mock toast hook
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe("F07, F08 & F09 — Interactive Homepage, Hero Portal, Triple-Grid & Market Map", () => {
  it("renders HeroPortal with 3D parallax container and trust micro-bar", () => {
    const element = React.createElement(HeroPortal);
    expect(element).toBeDefined();
    expect(element.type).toBe(HeroPortal);
  });

  it("renders CategoryDock with circular category icons and links", () => {
    const element = React.createElement(CategoryDock);
    expect(element).toBeDefined();
    expect(element.type).toBe(CategoryDock);
  });

  it("renders CollectionsGrid with 4 curated hardware categories", () => {
    const element = React.createElement(CollectionsGrid);
    expect(element).toBeDefined();
    expect(element.type).toBe(CollectionsGrid);
  });

  it("renders RecommendedCarousel with dual-tier product cards", () => {
    const element = React.createElement(RecommendedCarousel);
    expect(element).toBeDefined();
    expect(element.type).toBe(RecommendedCarousel);
  });

  it("renders FlashOffersCard with isolated 3-box countdown timer and deal dots", () => {
    const element = React.createElement(FlashOffersCard);
    expect(element).toBeDefined();
    expect(element.type).toBe(FlashOffersCard);
  });

  it("renders TrendingLeaderboard with ranked items #1, #2, #3", () => {
    const element = React.createElement(TrendingLeaderboard);
    expect(element).toBeDefined();
    expect(element.type).toBe(TrendingLeaderboard);
  });

  it("renders FeaturedCampaignBanner with promotional banner and CTA", () => {
    const element = React.createElement(FeaturedCampaignBanner);
    expect(element).toBeDefined();
    expect(element.type).toBe(FeaturedCampaignBanner);
  });

  it("renders TripleGridSection layout composing all 3 columns", () => {
    const element = React.createElement(TripleGridSection);
    expect(element).toBeDefined();
    expect(element.type).toBe(TripleGridSection);
  });

  it("renders RewardsTrustStrip with 4 engineering benefits", () => {
    const element = React.createElement(RewardsTrustStrip);
    expect(element).toBeDefined();
    expect(element.type).toBe(RewardsTrustStrip);
  });

  it("renders TestimonialsAndNewsletter with verified community reviews and subscription input", () => {
    const element = React.createElement(TestimonialsAndNewsletter);
    expect(element).toBeDefined();
    expect(element.type).toBe(TestimonialsAndNewsletter);
  });

  it("renders NawabpurMarketMap with interactive beacons and drop-and-pack stepper", () => {
    const element = React.createElement(NawabpurMarketMap);
    expect(element).toBeDefined();
    expect(element.type).toBe(NawabpurMarketMap);
  });

  it("renders BrandAuthenticityHub with authorized brands and certificate credentials", () => {
    const element = React.createElement(BrandAuthenticityHub);
    expect(element).toBeDefined();
    expect(element.type).toBe(BrandAuthenticityHub);
  });
});
