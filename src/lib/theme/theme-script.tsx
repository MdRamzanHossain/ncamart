import React from "react";

/**
 * Inline Theme Script — Enforces Clean Light Theme across NCAMart
 * Runs synchronously in <head> before page paint
 */
export function ThemeScript() {
  const code = `
    (function() {
      try {
        localStorage.setItem('nca_theme', 'light');
        document.documentElement.setAttribute('data-theme', 'light');
      } catch (e) {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    })();
  `;

  return (
    <script
      id="nca-theme-script"
      dangerouslySetInnerHTML={{ __html: code }}
    />
  );
}
