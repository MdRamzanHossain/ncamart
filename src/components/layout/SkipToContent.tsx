"use client";

import React from "react";
import { useLocale } from "@/context/LocaleContext";

export interface SkipToContentProps {
  targetId?: string;
  label?: string;
}

export function SkipToContent({
  targetId = "main-content",
  label,
}: SkipToContentProps) {
  const { t } = useLocale();
  const text = label || t("nav.skipToContent");

  return (
    <a
      href={`#${targetId}`}
      className="skip-link"
      data-testid="skip-to-content"
    >
      {text}
      <style jsx>{`
        .skip-link {
          position: absolute;
          top: -100px;
          left: 16px;
          background: #38bdf8;
          color: #032135;
          padding: 10px 18px;
          border-radius: 8px;
          font-weight: 800;
          font-size: 13px;
          z-index: 99999;
          text-decoration: none;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
          transition: top 0.15s ease-in-out;
        }

        .skip-link:focus,
        .skip-link:focus-visible {
          top: 16px;
          outline: 3px solid #f8fafc;
          outline-offset: 2px;
        }
      `}</style>
    </a>
  );
}
