import { describe, it, expect } from "vitest";
import React from "react";
import {
  TrustTopbar,
  MicroAnnouncementBar,
  MegaMenu,
  Navbar,
  Footer,
  StorefrontShell,
} from "../index";

describe("F04 — Storefront Shell, Topbar & Mega-Navigation", () => {
  it("exports all navigation layout components cleanly", () => {
    expect(TrustTopbar).toBeDefined();
    expect(MicroAnnouncementBar).toBeDefined();
    expect(MegaMenu).toBeDefined();
    expect(Navbar).toBeDefined();
    expect(Footer).toBeDefined();
    expect(StorefrontShell).toBeDefined();
  });

  it("creates React elements without throwing", () => {
    const topbar = React.createElement(TrustTopbar);
    expect(topbar.type).toBe(TrustTopbar);

    const banner = React.createElement(MicroAnnouncementBar);
    expect(banner.type).toBe(MicroAnnouncementBar);

    const menu = React.createElement(MegaMenu);
    expect(menu.type).toBe(MegaMenu);

    const footer = React.createElement(Footer);
    expect(footer.type).toBe(Footer);

    const shell = React.createElement(StorefrontShell, null, "Page Content");
    expect(shell.type).toBe(StorefrontShell);
  });
});
