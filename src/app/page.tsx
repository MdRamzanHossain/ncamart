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
} from "@/components/home";

export default function HomePage() {
  return (
    <StorefrontShell>
      {/* 1. Futuristic Hero Shopping Portal with 3D Parallax & Hologram Ring */}
      <HeroPortal />

      {/* 2. Circular Category Dock with Glassmorphic Icons & Spring Scale */}
      <CategoryDock />

      {/* 3. Interactive Collections (4-Card Grid with Expansion Morphing) */}
      <CollectionsGrid />

      {/* 4. Dual-Tier Recommended For You Carousel */}
      <RecommendedCarousel />

      {/* 5. Triple-Grid Power Section: Trending, Campaign Banner & Flash Offers */}
      <TripleGridSection />

      {/* 6. Rewards & 4-Pillar Engineering Trust Strip */}
      <RewardsTrustStrip />

      {/* 7. Verified Community Testimonials & Newsletter */}
      <TestimonialsAndNewsletter />
    </StorefrontShell>
  );
}

