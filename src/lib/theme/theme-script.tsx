import React from "react";

/**
 * Inline Theme Script to prevent Flash of Unstyled Theme (FOUT)
 * Runs synchronously in <head> before page paint
 */
export function ThemeScript() {
  const code = `
    (function() {
      try {
        var cookieMatch = document.cookie.match(/(?:^|; )nca_theme=([^;]*)/);
        var cookieTheme = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
        var localTheme = localStorage.getItem('nca_theme');
        var theme = cookieTheme || localTheme || 'dark';
        
        var resolved = theme;
        if (theme === 'system') {
          resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', resolved);
      } catch (e) {
        document.documentElement.setAttribute('data-theme', 'dark');
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
