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
        padding: "20px 20px 12px",
        maxWidth: "1340px",
        margin: "0 auto",
      }}
    >
      <div
        className="triple-grid-container"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.6fr 1fr",
          gap: "18px",
          alignItems: "stretch",
        }}
      >
        {/* Col 1: Trending Now Ranked Leaderboard */}
        <div style={{ minHeight: "280px" }}>
          <TrendingLeaderboard />
        </div>

        {/* Col 2: Featured Campaign Banner */}
        <div style={{ minHeight: "280px" }}>
          <FeaturedCampaignBanner />
        </div>

        {/* Col 3: Flash Offers with Live Countdown Clock */}
        <div style={{ minHeight: "280px" }}>
          <FlashOffersCard />
        </div>
      </div>
    </section>
  );
}

