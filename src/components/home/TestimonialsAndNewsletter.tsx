"use client";

import React, { useState } from "react";
import { useToast } from "@/components/ui/toast";

interface ReviewCard {
  name: string;
  role: string;
  district: string;
  stars: number;
  quote: string;
  productPurchased: string;
}

const REVIEWS: ReviewCard[] = [
  {
    name: "Tanvir Rahman",
    role: "Embedded Systems Engineer",
    district: "Dhaka (Mirpur DOHS)",
    stars: 5,
    quote:
      "Ordered the Mechanic T12 Pro station at 11 AM; delivered to my lab by 4 PM same day with holographic seal intact. Scanned on /verify and matched the serial instantly.",
    productPurchased: "Mechanic T12 Pro 72W",
  },
  {
    name: "Engr. Nazmul Hossain",
    role: "Hardware Lab Manager",
    district: "Chittagong (Agrabad)",
    stars: 5,
    quote:
      "For years we had to personally visit Nawabpur wholesale alleys. NCAMart’s drop-and-pack runners test OEM parts and verify authentic stock with zero hassle.",
    productPurchased: "Fluke 101 Multimeter + 100W GaN",
  },
  {
    name: "Mahfuz Ahmed",
    role: "Robotics Instructor",
    district: "Khulna (KUET Campus)",
    stars: 5,
    quote:
      "The Pre-Order tracking with milestone updates kept our department completely assured. Deposit paid via SSLCommerz, remaining paid on delivery. Flawless service.",
    productPurchased: "Siglent SDS1104X-E Scope",
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
        padding: "var(--space-2xl) var(--space-md)",
        maxWidth: "1400px",
        margin: "0 auto",
      }}
    >
      {/* "What Shoppers Say" Header */}
      <div style={{ textAlign: "center", marginBottom: "var(--space-xl)" }}>
        <div
          style={{
            fontSize: "var(--font-size-xs)",
            color: "var(--tier-authentic-gold)",
            fontWeight: "var(--font-weight-bold)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: "4px",
          }}
        >
          COMMUNITY & VERIFIED REVIEWS
        </div>
        <h2
          style={{
            fontSize: "clamp(1.5rem, 3vw, 2.2rem)",
            fontWeight: "800",
            color: "var(--text-primary)",
            margin: 0,
            letterSpacing: "-0.03em",
          }}
        >
          What Engineers & Makers Say
        </h2>
      </div>

      {/* 3 Review Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "var(--space-lg)",
          marginBottom: "var(--space-2xl)",
        }}
      >
        {REVIEWS.map((rev) => (
          <div
            key={rev.name}
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-xl)",
              padding: "var(--space-lg)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
            }}
          >
            <div>
              {/* Star Rating & Verified Badge */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "var(--space-sm)",
                }}
              >
                <div style={{ color: "var(--tier-authentic-gold)", fontSize: "14px", letterSpacing: "2px" }}>
                  {"★".repeat(rev.stars)}
                </div>

                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: "700",
                    padding: "2px 6px",
                    borderRadius: "var(--radius-xs)",
                    backgroundColor: "rgba(16, 185, 129, 0.15)",
                    color: "var(--color-status-success)",
                    display: "flex",
                    alignItems: "center",
                    gap: "3px",
                  }}
                >
                  <span>✓</span>
                  <span>Verified Buyer</span>
                </span>
              </div>

              {/* Quote */}
              <p
                style={{
                  fontSize: "var(--font-size-sm)",
                  color: "var(--text-secondary)",
                  lineHeight: "1.6",
                  fontStyle: "italic",
                  margin: "0 0 var(--space-md)",
                }}
              >
                &ldquo;{rev.quote}&rdquo;
              </p>
            </div>

            {/* Author Info */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                paddingTop: "var(--space-sm)",
                borderTop: "1px solid var(--border-subtle)",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #0b0f19 0%, #0d9488 100%)",
                  border: "1px solid var(--tier-authentic-gold)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "800",
                  fontSize: "14px",
                }}
              >
                {rev.name[0]}
              </div>

              <div>
                <div style={{ fontSize: "var(--font-size-xs)", fontWeight: "700", color: "var(--text-primary)" }}>
                  {rev.name}
                </div>
                <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>
                  {rev.role} • {rev.district}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* "Stay in the Loop" Newsletter Box */}
      <div
        style={{
          borderRadius: "var(--radius-xl)",
          background: "linear-gradient(135deg, #18181b 0%, #27272a 100%)",
          border: "1px solid var(--border-default)",
          padding: "var(--space-2xl) var(--space-xl)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: "var(--space-md)",
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.35)",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            backgroundColor: "rgba(245, 158, 11, 0.15)",
            border: "1px solid var(--tier-authentic-gold)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "22px",
          }}
        >
          📬
        </div>

        <div>
          <h3
            style={{
              fontSize: "clamp(1.3rem, 2.5vw, 1.8rem)",
              fontWeight: "800",
              color: "var(--text-primary)",
              margin: "0 0 6px",
            }}
          >
            Stay in the Loop
          </h3>
          <p
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--text-secondary)",
              maxWidth: "520px",
              margin: 0,
            }}
          >
            Be the first to get wholesale clearance announcements, pre-order import batches, and engineering tutorials.
          </p>
        </div>

        {/* Input Form */}
        <form
          onSubmit={handleSubscribe}
          style={{
            display: "flex",
            gap: "var(--space-xs)",
            width: "100%",
            maxWidth: "460px",
            marginTop: "var(--space-xs)",
          }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address..."
            style={{
              flex: 1,
              backgroundColor: "var(--bg-canvas)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-full)",
              padding: "10px 16px",
              color: "var(--text-primary)",
              fontSize: "var(--font-size-sm)",
              outline: "none",
            }}
            required
          />

          <button
            type="submit"
            disabled={isSubscribing}
            style={{
              padding: "10px 22px",
              borderRadius: "var(--radius-full)",
              background: "linear-gradient(135deg, #ff6b35 0%, #f43f5e 100%)",
              color: "#ffffff",
              border: "none",
              fontWeight: "700",
              fontSize: "var(--font-size-sm)",
              cursor: isSubscribing ? "not-allowed" : "pointer",
              boxShadow: "0 4px 12px rgba(244, 63, 94, 0.35)",
            }}
            className="interactive-scale"
          >
            {isSubscribing ? "Joining..." : "Subscribe"}
          </button>
        </form>

        <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
          No spam, ever. Unsubscribe at any time with one click.
        </div>
      </div>
    </section>
  );
}
