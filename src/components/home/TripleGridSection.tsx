"use client";

import React from "react";
import { TrendingLeaderboard } from "./TrendingLeaderboard";
import { FeaturedCampaignBanner } from "./FeaturedCampaignBanner";
import { FlashOffersCard } from "./FlashOffersCard";

export function TripleGridSection() {
  return (
    <section
      aria-label="Trending, Campaign and Flash Offers"
      style={{
        padding: "var(--space-2xl) var(--space-md)",
        maxWidth: "1400px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
          gap: "var(--space-lg)",
          alignItems: "stretch",
        }}
      >
        {/* Col 1: Trending Now Ranked Leaderboard */}
        <div style={{ minHeight: "420px" }}>
          <TrendingLeaderboard />
        </div>

        {/* Col 2: Featured Campaign Banner */}
        <div style={{ minHeight: "420px" }}>
          <FeaturedCampaignBanner />
        </div>

        {/* Col 3: Flash Offers with Live Countdown Clock */}
        <div style={{ minHeight: "420px" }}>
          <FlashOffersCard />
        </div>
      </div>
    </section>
  );
}
