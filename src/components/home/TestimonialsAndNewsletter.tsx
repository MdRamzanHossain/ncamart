"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/toast";

interface ReviewCard {
  name: string;
  stars: number;
  quote: string;
  icon: string;
  tint: string;
}

const REVIEWS: ReviewCard[] = [
  {
    name: "Tanvir R.",
    stars: 5,
    quote: "Amazing quality and super fast delivery! NCAMart is now my go-to Nawabpur hardware app.",
    icon: "🎧",
    tint: "#e0e7ff",
  },
  {
    name: "Engr. Nazmul H.",
    stars: 5,
    quote: "Love the wide dual-tier variety and the holographic seal verification is fantastic!",
    icon: "⌚",
    tint: "#dbeafe",
  },
  {
    name: "Mahfuz A.",
    stars: 5,
    quote: "The wholesale deals are unbeatable and engineer support is so helpful.",
    icon: "🔬",
    tint: "#fce7f3",
  },
];

export function TestimonialsAndNewsletter() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast({
        variant: "destructive",
        title: "Invalid Email",
        description: "Please enter a valid email address.",
      });
      return;
    }

    setIsSubscribing(true);
    setTimeout(() => {
      setIsSubscribing(false);
      setEmail("");
      toast({
        variant: "success",
        title: "Subscribed Successfully! 🎉",
        description: "Welcome to NCAMart Insider. You will receive exclusive flash drops and wholesale clearance alerts.",
      });
    }, 600);
  };

  return (
    <section
      aria-label="Customer Reviews & Newsletter"
      style={{
        padding: "20px 20px 32px",
        maxWidth: "1340px",
        margin: "0 auto",
      }}
    >
      {/* "What Shoppers Say" Header matching Reference Design */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <h2
          style={{
            fontSize: "20px",
            fontWeight: "800",
            color: "var(--text-primary)",
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          What Shoppers Say
        </h2>

        <Link
          href="/catalog"
          style={{
            fontSize: "13px",
            fontWeight: "700",
            color: "#2563eb",
            textDecoration: "none",
          }}
        >
          View All Reviews
        </Link>
      </div>

      {/* 3 Horizontal Review Cards matching Reference Design */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: "18px",
          marginBottom: "22px",
        }}
      >
        {REVIEWS.map((rev) => (
          <div
            key={rev.name}
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: "18px",
              padding: "16px 18px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              boxShadow: "0 6px 18px rgba(15, 23, 42, 0.04)",
            }}
          >
            {/* Left Circular Product/Reviewer Visual */}
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                backgroundColor: rev.tint,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "28px",
                flexShrink: 0,
              }}
            >
              {rev.icon}
            </div>

            {/* Right Name, Stars & Quote */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>
                {rev.name}
              </div>
              <div style={{ color: "#f59e0b", fontSize: "12px", letterSpacing: "1px", margin: "1px 0 4px" }}>
                {"★".repeat(rev.stars)}
              </div>
              <p
                style={{
                  fontSize: "11.5px",
                  color: "var(--text-secondary)",
                  lineHeight: "1.45",
                  margin: 0,
                }}
              >
                {rev.quote}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* "Stay in the Loop" Horizontal Bar matching Reference Design */}
      <div
        style={{
          borderRadius: "18px",
          backgroundColor: "#ffffff",
          border: "1px solid #e2e8f0",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "18px",
          boxShadow: "0 6px 20px rgba(15, 23, 42, 0.04)",
        }}
      >
        {/* Left: Envelope Icon + Stay in the Loop */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              backgroundColor: "#eff6ff",
              color: "#1e3a8a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              flexShrink: 0,
            }}
          >
            ✉️
          </div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>
              Stay in the Loop
            </div>
            <div style={{ fontSize: "11.5px", color: "#64748b" }}>
              Get exclusive deals, new arrivals, and more.
            </div>
          </div>
        </div>

        {/* Center: Connected Email Input + Coral Subscribe Button */}
        <form
          onSubmit={handleSubscribe}
          className="newsletter-form"
          style={{
            display: "flex",
            alignItems: "center",
            flex: 1,
            maxWidth: "430px",
            borderRadius: "10px",
            border: "1px solid #cbd5e1",
            backgroundColor: "#f8fafc",
            overflow: "hidden",
          }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            style={{
              flex: 1,
              backgroundColor: "transparent",
              border: "none",
              padding: "10px 14px",
              color: "#0f172a",
              fontSize: "12.5px",
              outline: "none",
            }}
            required
          />

          <button
            type="submit"
            disabled={isSubscribing}
            style={{
              padding: "10px 22px",
              background: "linear-gradient(90deg, #ff5e62 0%, #ff7b54 100%)",
              color: "#ffffff",
              border: "none",
              fontWeight: "700",
              fontSize: "12.5px",
              cursor: isSubscribing ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {isSubscribing ? "Joining..." : "Subscribe"}
          </button>
        </form>

        {/* Right: Follow Us + 5 Social Icons */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a", marginRight: "4px" }}>
            Follow Us
          </span>
          {[
            { label: "Instagram", icon: "📷" },
            { label: "TikTok", icon: "🎵" },
            { label: "YouTube", icon: "▶️" },
            { label: "Facebook", icon: "f" },
            { label: "Twitter", icon: "𝕏" },
          ].map((soc) => (
            <a
              key={soc.label}
              href="#footer"
              aria-label={soc.label}
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "50%",
                backgroundColor: "#f1f5f9",
                border: "1px solid #e2e8f0",
                color: "#334155",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: "700",
                textDecoration: "none",
              }}
            >
              {soc.icon}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

