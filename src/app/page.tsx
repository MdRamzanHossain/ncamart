import React from "react";
import { StorefrontShell } from "@/components/layout";
import {
  HeroPortal,
  CategoryDock,
  CollectionsGrid,
  RecommendedCarousel,
  TripleGridSection,
  RewardsTrustStrip,
  TestimonialsAndNewsletter,
  NawabpurMarketMap,
  BrandAuthenticityHub,
} from "@/components/home";

export default function HomePage() {
  return (
    <StorefrontShell>
      {/* 1. Futuristic Hero Shopping Portal with 3D Parallax & Hologram Cylinder */}
      <HeroPortal />

      {/* 2. Floating White Category Dock Overlapping Hero Bottom */}
      <CategoryDock />

      {/* 3. Interactive Collections (4 Pastel Cards) */}
      <CollectionsGrid />

      {/* 4. Recommended For You 6-Card Carousel */}
      <RecommendedCarousel />

      {/* 5. Triple-Grid Section: Trending Now, Refresh Sale Banner & Flash Offers */}
      <TripleGridSection />

      {/* 6. Rewards & 4-Pillar Horizontal Indigo Strip */}
      <RewardsTrustStrip />

      {/* 7. What Shoppers Say & Stay in the Loop Bar */}
      <TestimonialsAndNewsletter />

      {/* 8. Nawabpur Tech Corridor Interactive Map & Drop-and-Pack Sourcing */}
      <NawabpurMarketMap />

      {/* 9. Authorized Brand Authenticity & Credentials Hub */}
      <BrandAuthenticityHub />
    </StorefrontShell>
  );
}


