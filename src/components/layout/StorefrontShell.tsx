"use client";

import React, { useState } from "react";
import { TrustTopbar } from "./TrustTopbar";
import { MicroAnnouncementBar } from "./MicroAnnouncementBar";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileNavDrawer } from "./MobileNavDrawer";
import { PullToRefresh } from "./PullToRefresh";
import { SearchModal } from "@/components/search";

export function StorefrontShell({ children }: { children: React.ReactNode }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
      <Navbar
        onSearchClick={() => setIsSearchOpen(true)}
        onMobileMenuClick={() => setIsMobileMenuOpen(true)}
      />

      {/* 4. Global Cmd+K Instant Search & Discovery Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* 5. Mobile Slide-Over Navigation Drawer */}
      <MobileNavDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onSearchClick={() => setIsSearchOpen(true)}
      />

      {/* 6. Page Main Content Body with Pull-to-Refresh */}
      <main
        id="main-content"
        style={{
          flex: 1,
          paddingBottom: "var(--space-2xl)", // Padding to avoid dock overlap on mobile
        }}
      >
        <PullToRefresh>{children}</PullToRefresh>
      </main>

      {/* 7. Comprehensive Legal & High-Trust Footer */}
      <Footer />

      {/* 8. Fixed Native Mobile Bottom Dock */}
      <MobileBottomNav onOpenCategories={() => setIsMobileMenuOpen(true)} />
    </div>
  );
}


