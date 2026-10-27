import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import fs from "fs";
import path from "path";
import { SkipToContent } from "../SkipToContent";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { AdminShell } from "@/components/admin/AdminShell";
import { LocaleProvider } from "@/context/LocaleContext";
import { ToastProvider } from "@/components/ui/toast";

describe("F37: Accessibility, Internationalization & Reduced Motion", () => {
  it("renders SkipToContent link targeting #main-content with localized label", () => {
    // English
    const enHtml = renderToString(
      <LocaleProvider defaultLocale="en">
        <SkipToContent />
      </LocaleProvider>
    );
    expect(enHtml).toContain('href="#main-content"');
    expect(enHtml).toContain("skip-link");
    expect(enHtml).toContain("Skip to main content");

    // Bengali
    const bnHtml = renderToString(
      <LocaleProvider defaultLocale="bn">
        <SkipToContent />
      </LocaleProvider>
    );
    expect(bnHtml).toContain('href="#main-content"');
    expect(bnHtml).toContain("মূল বিষয়বস্তুতে যান");
  });

  it("renders LanguageSwitcher with proper ARIA attributes (radiogroup, radio, aria-checked)", () => {
    const html = renderToString(
      <LocaleProvider defaultLocale="bn">
        <LanguageSwitcher />
      </LocaleProvider>
    );

    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Select interface language"');
    expect(html).toContain('role="radio"');
    expect(html).toContain('aria-checked="true"'); // Bengali is active
    expect(html).toContain("বাংলা");
    expect(html).toContain("English");
  });

  it("renders AdminShell with accessible admin skip link targeting #admin-main-content", () => {
    const html = renderToString(
      <ToastProvider>
        <AdminShell>
          <div data-testid="test-admin-child">Admin View Content</div>
        </AdminShell>
      </ToastProvider>
    );

    // Skip Link
    expect(html).toContain('href="#admin-main-content"');
    expect(html).toContain("admin-skip-link");
    expect(html).toContain("Skip to admin operations");

    // Target Main Container
    expect(html).toContain('id="admin-main-content"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain("test-admin-child");
  });

  it("enforces WCAG 2.1 AA reduced motion media queries in globals.css", () => {
    const globalsCssPath = path.resolve(process.cwd(), "src/styles/globals.css");
    const globalsCss = fs.readFileSync(globalsCssPath, "utf-8");

    expect(globalsCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(globalsCss).toContain("animation-duration: 0.01ms !important;");
    expect(globalsCss).toContain("transition-duration: 0.01ms !important;");
    expect(globalsCss).toContain("scroll-behavior: auto !important;");
  });
});
