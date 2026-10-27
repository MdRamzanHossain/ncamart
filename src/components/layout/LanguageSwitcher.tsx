"use client";

import React from "react";
import { useLocale } from "@/context/LocaleContext";

export interface LanguageSwitcherProps {
  className?: string;
}

export function LanguageSwitcher({ className = "" }: LanguageSwitcherProps) {
  const { locale, setLocale } = useLocale();

  return (
    <div
      className={`lang-switcher ${className}`}
      role="radiogroup"
      aria-label="Select interface language"
      data-testid="language-switcher"
    >
      <button
        type="button"
        role="radio"
        aria-checked={locale === "bn"}
        className={`lang-btn ${locale === "bn" ? "active" : ""}`}
        onClick={() => setLocale("bn")}
        data-testid="lang-btn-bn"
        title="বাংলা ইন্টারফেস বেছে নিন"
      >
        বাংলা
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={locale === "en"}
        className={`lang-btn ${locale === "en" ? "active" : ""}`}
        onClick={() => setLocale("en")}
        data-testid="lang-btn-en"
        title="Select English interface"
      >
        English
      </button>

      <style jsx>{`
        .lang-switcher {
          display: inline-flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 9999px;
          padding: 2px;
          gap: 2px;
        }

        .lang-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 9999px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .lang-btn:hover {
          color: #f8fafc;
        }

        .lang-btn.active {
          background: #38bdf8;
          color: #032135;
          font-weight: 800;
        }

        .lang-btn:focus-visible {
          outline: 2px solid #38bdf8;
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}
