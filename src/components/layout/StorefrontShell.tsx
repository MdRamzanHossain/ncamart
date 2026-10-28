"use client";

import React, { useState, useEffect } from "react";
import { TrustTopbar } from "./TrustTopbar";
import { MicroAnnouncementBar } from "./MicroAnnouncementBar";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileNavDrawer } from "./MobileNavDrawer";
import { PullToRefresh } from "./PullToRefresh";
import { SearchModal } from "@/components/search";
import { CartDrawer } from "@/components/cart";

export function StorefrontShell({ children }: { children: React.ReactNode }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Global event listener to open cart from any component (e.g., PDP Add to Cart, ProductCard quick add)
  useEffect(() => {
    const handleOpenCart = () => setIsCartOpen(true);
    const handleCartAdd = () => setIsCartOpen(true);

    if (typeof window !== "undefined") {
      window.addEventListener("ncamart:open-cart", handleOpenCart);
      window.addEventListener("ncamart:cart-add", handleCartAdd);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("ncamart:open-cart", handleOpenCart);
        window.removeEventListener("ncamart:cart-add", handleCartAdd);
      }
    };
  }, []);

  return (
    <div
      className="storefront-shell-root"
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
        onCartClick={() => setIsCartOpen(true)}
      />

      {/* 4. Global Cmd+K Instant Search & Discovery Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* 5. Mobile Slide-Over Navigation Drawer */}
      <MobileNavDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onSearchClick={() => setIsSearchOpen(true)}
      />

      {/* 6. Slide-Over Cart Drawer with 15-Minute Reservation Timer */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* 7. Page Main Content Body with Pull-to-Refresh */}
      <main
        id="main-content"
        style={{
          flex: 1,
          paddingBottom: "var(--space-2xl)", // Padding to avoid dock overlap on mobile
        }}
      >
        <PullToRefresh>{children}</PullToRefresh>
      </main>

      {/* 8. Comprehensive Legal & High-Trust Footer */}
      <Footer />

      {/* 9. Fixed Native Mobile Bottom Dock */}
      <MobileBottomNav
        onOpenCategories={() => setIsMobileMenuOpen(true)}
        onCartClick={() => setIsCartOpen(true)}
      />
    </div>
  );
}
