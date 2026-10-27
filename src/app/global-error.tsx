"use client";

import React from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalRootError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: "#0b0f19",
          color: "#f9fafb",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            maxWidth: "560px",
            width: "90%",
            margin: "40px auto",
            padding: "40px 32px",
            backgroundColor: "#111827",
            borderRadius: "20px",
            border: "1px solid rgba(239, 68, 68, 0.35)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              margin: "0 auto 20px auto",
              borderRadius: "16px",
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
            }}
          >
            ⚠️
          </div>

          <span
            style={{
              display: "inline-block",
              padding: "3px 10px",
              borderRadius: "9999px",
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              color: "#fca5a5",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              marginBottom: "14px",
            }}
          >
            CRITICAL KERNEL EXCEPTION
          </span>

          <h1
            style={{
              fontSize: "24px",
              fontWeight: 800,
              color: "#f9fafb",
              margin: "0 0 10px 0",
            }}
          >
            Root Layout Interrupted
          </h1>

          <p
            style={{
              fontSize: "14px",
              lineHeight: 1.6,
              color: "#9ca3af",
              margin: "0 0 24px 0",
            }}
          >
            A critical exception halted the foundational root layout of the Nawabpur Complex application.
          </p>

          <button
            type="button"
            onClick={() => reset()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 24px",
              borderRadius: "10px",
              backgroundColor: "#ef4444",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(239, 68, 68, 0.4)",
            }}
          >
            Reload Application (অ্যাপ রিলোড করুন)
          </button>
        </div>
      </body>
    </html>
  );
}
