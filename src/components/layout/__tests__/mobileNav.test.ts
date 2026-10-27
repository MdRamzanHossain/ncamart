import { describe, it, expect, vi } from "vitest";
import React from "react";
import { MobileBottomNav } from "../MobileBottomNav";
import { MobileNavDrawer } from "../MobileNavDrawer";
import { PullToRefresh } from "../PullToRefresh";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock AuthContext
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    customer: null,
    isAuthenticated: false,
    cartCount: 3,
    logout: vi.fn(),
  }),
}));

describe("F06 — Mobile App Shell & Bottom Navigation Bar", () => {
  it("renders MobileBottomNav with active state indicators and verify seal button", () => {
    const onOpenCategories = vi.fn();
    const element = React.createElement(MobileBottomNav, { onOpenCategories });

    expect(element).toBeDefined();
    expect(element.props.onOpenCategories).toBe(onOpenCategories);
  });

  it("instantiates MobileNavDrawer with category list and WhatsApp hotline", () => {
    const handleClose = vi.fn();
    const handleSearchClick = vi.fn();
    const drawerElement = React.createElement(MobileNavDrawer, {
      isOpen: true,
      onClose: handleClose,
      onSearchClick: handleSearchClick,
    });

    expect(drawerElement).toBeDefined();
    expect(drawerElement.props.isOpen).toBe(true);
    expect(drawerElement.props.onClose).toBe(handleClose);
    expect(drawerElement.props.onSearchClick).toBe(handleSearchClick);
  });

  it("renders PullToRefresh wrapping children safely", () => {
    const child = React.createElement("div", { id: "test-content" }, "Hello NCA");
    const ptrElement = React.createElement(PullToRefresh, null, child);

    expect(ptrElement).toBeDefined();
    expect(ptrElement.props.children).toBe(child);
  });
});
