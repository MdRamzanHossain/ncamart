"use client";

import React, { useState } from "react";
import { TrustTopbar } from "./TrustTopbar";
import { MicroAnnouncementBar } from "./MicroAnnouncementBar";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { SearchModal } from "@/components/search";

export function StorefrontShell({ children }: { children: React.ReactNode }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        backgroundColor: "var(--bg-canvas)",
      }}
    >
      {/* 1. Showroom Physical Trust Topbar */}
      <TrustTopbar />

      {/* 2. Micro Announcement Bar */}
      <MicroAnnouncementBar />

      {/* 3. Sticky Compressing Navbar with MegaMenu */}
      <Navbar onSearchClick={() => setIsSearchOpen(true)} />

      {/* 4. Global Cmd+K Instant Search & Discovery Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* 5. Page Main Content Body */}
      <main id="main-content" style={{ flex: 1 }}>
        {children}
      </main>

      {/* 6. Comprehensive Legal & High-Trust Footer */}
      <Footer />
    </div>
  );
}

